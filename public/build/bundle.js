var app = (function () {
    'use strict';

    function noop() { }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function prevent_default(fn) {
        return function (event) {
            event.preventDefault();
            // @ts-ignore
            return fn.call(this, event);
        };
    }
    function stop_propagation(fn) {
        return function (event) {
            event.stopPropagation();
            // @ts-ignore
            return fn.call(this, event);
        };
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_data(text, data) {
        data = '' + data;
        if (text.wholeText !== data)
            text.data = data;
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail);
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
            }
        };
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    function add_flush_callback(fn) {
        flush_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }

    function destroy_block(block, lookup) {
        block.d(1);
        lookup.delete(block.key);
    }
    function update_keyed_each(old_blocks, dirty, get_key, dynamic, ctx, list, lookup, node, destroy, create_each_block, next, get_context) {
        let o = old_blocks.length;
        let n = list.length;
        let i = o;
        const old_indexes = {};
        while (i--)
            old_indexes[old_blocks[i].key] = i;
        const new_blocks = [];
        const new_lookup = new Map();
        const deltas = new Map();
        i = n;
        while (i--) {
            const child_ctx = get_context(ctx, list, i);
            const key = get_key(child_ctx);
            let block = lookup.get(key);
            if (!block) {
                block = create_each_block(key, child_ctx);
                block.c();
            }
            else if (dynamic) {
                block.p(child_ctx, dirty);
            }
            new_lookup.set(key, new_blocks[i] = block);
            if (key in old_indexes)
                deltas.set(key, Math.abs(i - old_indexes[key]));
        }
        const will_move = new Set();
        const did_move = new Set();
        function insert(block) {
            transition_in(block, 1);
            block.m(node, next);
            lookup.set(block.key, block);
            next = block.first;
            n--;
        }
        while (o && n) {
            const new_block = new_blocks[n - 1];
            const old_block = old_blocks[o - 1];
            const new_key = new_block.key;
            const old_key = old_block.key;
            if (new_block === old_block) {
                // do nothing
                next = new_block.first;
                o--;
                n--;
            }
            else if (!new_lookup.has(old_key)) {
                // remove old block
                destroy(old_block, lookup);
                o--;
            }
            else if (!lookup.has(new_key) || will_move.has(new_key)) {
                insert(new_block);
            }
            else if (did_move.has(old_key)) {
                o--;
            }
            else if (deltas.get(new_key) > deltas.get(old_key)) {
                did_move.add(new_key);
                insert(new_block);
            }
            else {
                will_move.add(old_key);
                o--;
            }
        }
        while (o--) {
            const old_block = old_blocks[o];
            if (!new_lookup.has(old_block.key))
                destroy(old_block, lookup);
        }
        while (n)
            insert(new_blocks[n - 1]);
        return new_blocks;
    }

    function bind(component, name, callback) {
        const index = component.$$.props[name];
        if (index !== undefined) {
            component.$$.bound[index] = callback;
            callback(component.$$.ctx[index]);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    const subscriber_queue = [];
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = [];
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (let i = 0; i < subscribers.length; i += 1) {
                        const s = subscribers[i];
                        s[1]();
                        subscriber_queue.push(s, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.push(subscriber);
            if (subscribers.length === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                const index = subscribers.indexOf(subscriber);
                if (index !== -1) {
                    subscribers.splice(index, 1);
                }
                if (subscribers.length === 0) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }

    const store = writable([]);
    const key = 'order';

    if (localStorage.getItem(key)) {
      store.set(JSON.parse(
        localStorage.getItem(key)
      ));
    }

    const add = (order, price) => {
      store.update((items) => {
        const item = {
          order,
          price,
          id: new Date().getTime(),
          count: 1
        };
        return [item, ...items]
      });
    };

    const edit = (id, order, price) => {
      store.update((items) => {
        const index = items.findIndex((i) => i.id === id);
        if (index == -1) {
          return items
        }
        items[index].order = order;
        items[index].price = price;
        return items
      });
    };

    const remove = (id) => {
      store.update((items) => {
        return items.filter((i) => i.id !== id)
      });
    };

    const changeCount = (id, count) => {
      store.update((items) => {
        const index = items.findIndex((i) => i.id === id);
        if (index == -1) {
          return items
        }
        items[index].count = count;
        return items
      });
    };

    store.subscribe((items) => {
      const jsonString = JSON.stringify(items);
      localStorage.setItem(key, jsonString);
    });

    var store$1 = {
      subscribe: store.subscribe,
      add,
      edit,
      remove,
      changeCount
    };

    /* src/components/Table.svelte generated by Svelte v3.32.3 */

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[9] = list[i];
    	child_ctx[10] = list;
    	child_ctx[11] = i;
    	return child_ctx;
    }

    // (81:4) {#each orders as order (order.id)}
    function create_each_block(key_1, ctx) {
    	let tr;
    	let td0;
    	let t0_value = /*order*/ ctx[9].order + "";
    	let t0;
    	let t1;
    	let td1;
    	let t2_value = /*currencyFormat*/ ctx[2].format(/*order*/ ctx[9].price) + "";
    	let t2;
    	let t3;
    	let td2;
    	let div0;
    	let t5;
    	let input;
    	let t6;
    	let div1;
    	let t8;
    	let td3;
    	let i;
    	let mounted;
    	let dispose;

    	function input_input_handler() {
    		/*input_input_handler*/ ctx[7].call(input, /*each_value*/ ctx[10], /*order_index*/ ctx[11]);
    	}

    	return {
    		key: key_1,
    		first: null,
    		c() {
    			tr = element("tr");
    			td0 = element("td");
    			t0 = text(t0_value);
    			t1 = space();
    			td1 = element("td");
    			t2 = text(t2_value);
    			t3 = space();
    			td2 = element("td");
    			div0 = element("div");
    			div0.textContent = "-";
    			t5 = space();
    			input = element("input");
    			t6 = space();
    			div1 = element("div");
    			div1.textContent = "+";
    			t8 = space();
    			td3 = element("td");
    			i = element("i");
    			attr(div0, "class", "two columns svelte-1ynae2t");
    			attr(div0, "type", "button");
    			attr(input, "class", "count-input svelte-1ynae2t");
    			attr(input, "min", "1");
    			attr(input, "step", "any");
    			attr(input, "type", "text");
    			attr(input, "name", "count");
    			attr(div1, "class", "two columns svelte-1ynae2t");
    			attr(div1, "type", "button");
    			attr(td2, "class", "button-box svelte-1ynae2t");
    			attr(i, "class", "far fa-trash-alt");
    			attr(tr, "class", "order svelte-1ynae2t");
    			this.first = tr;
    		},
    		m(target, anchor) {
    			insert(target, tr, anchor);
    			append(tr, td0);
    			append(td0, t0);
    			append(tr, t1);
    			append(tr, td1);
    			append(td1, t2);
    			append(tr, t3);
    			append(tr, td2);
    			append(td2, div0);
    			append(td2, t5);
    			append(td2, input);
    			set_input_value(input, /*order*/ ctx[9].count);
    			append(td2, t6);
    			append(td2, div1);
    			append(tr, t8);
    			append(tr, td3);
    			append(td3, i);

    			if (!mounted) {
    				dispose = [
    					listen(div0, "click", stop_propagation(function () {
    						if (is_function(/*minus*/ ctx[5](/*order*/ ctx[9].id, /*order*/ ctx[9].count))) /*minus*/ ctx[5](/*order*/ ctx[9].id, /*order*/ ctx[9].count).apply(this, arguments);
    					})),
    					listen(input, "input", input_input_handler),
    					listen(div1, "click", stop_propagation(function () {
    						if (is_function(/*add*/ ctx[6](/*order*/ ctx[9].id, /*order*/ ctx[9].count))) /*add*/ ctx[6](/*order*/ ctx[9].id, /*order*/ ctx[9].count).apply(this, arguments);
    					})),
    					listen(i, "click", stop_propagation(function () {
    						if (is_function(/*remove*/ ctx[4](/*order*/ ctx[9].id))) /*remove*/ ctx[4](/*order*/ ctx[9].id).apply(this, arguments);
    					})),
    					listen(tr, "click", function () {
    						if (is_function(/*edit*/ ctx[3](/*order*/ ctx[9].id, /*order*/ ctx[9].order, /*order*/ ctx[9].price, /*order*/ ctx[9].count))) /*edit*/ ctx[3](/*order*/ ctx[9].id, /*order*/ ctx[9].order, /*order*/ ctx[9].price, /*order*/ ctx[9].count).apply(this, arguments);
    					})
    				];

    				mounted = true;
    			}
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty & /*orders*/ 1 && t0_value !== (t0_value = /*order*/ ctx[9].order + "")) set_data(t0, t0_value);
    			if (dirty & /*orders*/ 1 && t2_value !== (t2_value = /*currencyFormat*/ ctx[2].format(/*order*/ ctx[9].price) + "")) set_data(t2, t2_value);

    			if (dirty & /*orders*/ 1 && input.value !== /*order*/ ctx[9].count) {
    				set_input_value(input, /*order*/ ctx[9].count);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(tr);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    function create_fragment(ctx) {
    	let table;
    	let thead;
    	let t6;
    	let tbody;
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let t7;
    	let tr1;
    	let td0;
    	let t9;
    	let td1;
    	let t10_value = /*currencyFormat*/ ctx[2].format(/*total*/ ctx[1]) + "";
    	let t10;
    	let each_value = /*orders*/ ctx[0];
    	const get_key = ctx => /*order*/ ctx[9].id;

    	for (let i = 0; i < each_value.length; i += 1) {
    		let child_ctx = get_each_context(ctx, each_value, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block(key, child_ctx));
    	}

    	return {
    		c() {
    			table = element("table");
    			thead = element("thead");

    			thead.innerHTML = `<tr><th>Item</th> 
      <th>Price</th> 
      <th>Count</th> 
      <th></th></tr>`;

    			t6 = space();
    			tbody = element("tbody");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t7 = space();
    			tr1 = element("tr");
    			td0 = element("td");
    			td0.textContent = "Total";
    			t9 = space();
    			td1 = element("td");
    			t10 = text(t10_value);
    			attr(td1, "colspan", "3");
    			attr(table, "class", "primary svelte-1ynae2t");
    		},
    		m(target, anchor) {
    			insert(target, table, anchor);
    			append(table, thead);
    			append(table, t6);
    			append(table, tbody);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(tbody, null);
    			}

    			append(tbody, t7);
    			append(tbody, tr1);
    			append(tr1, td0);
    			append(tr1, t9);
    			append(tr1, td1);
    			append(td1, t10);
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*edit, orders, remove, add, minus, currencyFormat*/ 125) {
    				each_value = /*orders*/ ctx[0];
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, tbody, destroy_block, create_each_block, t7, get_each_context);
    			}

    			if (dirty & /*total*/ 2 && t10_value !== (t10_value = /*currencyFormat*/ ctx[2].format(/*total*/ ctx[1]) + "")) set_data(t10, t10_value);
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(table);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d();
    			}
    		}
    	};
    }

    function instance($$self, $$props, $$invalidate) {
    	let total;
    	const dispatch = createEventDispatcher();
    	let orders = [];

    	store$1.subscribe(items => {
    		$$invalidate(0, orders = items);
    	});

    	const currencyFormat = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

    	function edit(id, order, price, count) {
    		dispatch("edit", { id, order, price, count });
    	}

    	function remove(id) {
    		// 如果传参进来evenet那么event.stopPropagation()
    		// 或者在标签页直接像现在这样用svelte语法，直接在便签中添加stopPropagation
    		store$1.remove(id);
    	}

    	function minus(id, count) {
    		if (count > 1) {
    			count -= 1;
    			store$1.changeCount(id, count);
    		}
    	}

    	function add(id, count) {
    		count += 1;
    		store$1.changeCount(id, count);
    	}

    	function input_input_handler(each_value, order_index) {
    		each_value[order_index].count = this.value;
    		$$invalidate(0, orders);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*orders*/ 1) {
    			$$invalidate(1, total = orders.reduce(
    				(prev, next) => {
    					prev += Number(next.price) * next.count;
    					return prev;
    				},
    				0
    			));
    		}
    	};

    	return [orders, total, currencyFormat, edit, remove, minus, add, input_input_handler];
    }

    class Table extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance, create_fragment, safe_not_equal, {});
    	}
    }

    /* src/components/Form.svelte generated by Svelte v3.32.3 */

    function create_if_block(ctx) {
    	let button;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			button = element("button");
    			button.textContent = "cancel";
    			attr(button, "class", "float-right svelte-rsh4tk");
    			attr(button, "type", "button");
    		},
    		m(target, anchor) {
    			insert(target, button, anchor);

    			if (!mounted) {
    				dispose = listen(button, "click", /*cancel*/ ctx[6]);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(button);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    function create_fragment$1(ctx) {
    	let form;
    	let fieldset;
    	let label0;
    	let t1;
    	let input0;
    	let t2;
    	let label1;
    	let t4;
    	let input1;
    	let t5;
    	let button;
    	let t6;
    	let button_disabled_value;
    	let t7;
    	let mounted;
    	let dispose;
    	let if_block = /*id*/ ctx[0] && create_if_block(ctx);

    	return {
    		c() {
    			form = element("form");
    			fieldset = element("fieldset");
    			label0 = element("label");
    			label0.textContent = "Order Item";
    			t1 = space();
    			input0 = element("input");
    			t2 = space();
    			label1 = element("label");
    			label1.textContent = "Price Per Unit";
    			t4 = space();
    			input1 = element("input");
    			t5 = space();
    			button = element("button");
    			t6 = text(/*mode*/ ctx[3]);
    			t7 = space();
    			if (if_block) if_block.c();
    			attr(label0, "for", "order");
    			attr(input0, "type", "text");
    			attr(input0, "name", "order");
    			attr(input0, "id", "order");
    			attr(input0, "placeholder", "Please enter your order item!");
    			attr(label1, "for", "price");
    			attr(input1, "min", "0");
    			attr(input1, "step", "any");
    			attr(input1, "type", "text");
    			attr(input1, "name", "price");
    			attr(input1, "id", "price");
    			attr(input1, "placeholder", "Please enter your price!");
    			button.disabled = button_disabled_value = !/*canSubmit*/ ctx[4];
    			attr(button, "class", "float-right svelte-rsh4tk");
    			attr(button, "type", "submit");
    		},
    		m(target, anchor) {
    			insert(target, form, anchor);
    			append(form, fieldset);
    			append(fieldset, label0);
    			append(fieldset, t1);
    			append(fieldset, input0);
    			set_input_value(input0, /*order*/ ctx[1]);
    			append(fieldset, t2);
    			append(fieldset, label1);
    			append(fieldset, t4);
    			append(fieldset, input1);
    			set_input_value(input1, /*price*/ ctx[2]);
    			append(form, t5);
    			append(form, button);
    			append(button, t6);
    			append(form, t7);
    			if (if_block) if_block.m(form, null);

    			if (!mounted) {
    				dispose = [
    					listen(input0, "input", /*input0_input_handler*/ ctx[7]),
    					listen(input1, "input", /*input1_input_handler*/ ctx[8]),
    					listen(form, "submit", prevent_default(/*submit*/ ctx[5]))
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*order*/ 2 && input0.value !== /*order*/ ctx[1]) {
    				set_input_value(input0, /*order*/ ctx[1]);
    			}

    			if (dirty & /*price*/ 4 && input1.value !== /*price*/ ctx[2]) {
    				set_input_value(input1, /*price*/ ctx[2]);
    			}

    			if (dirty & /*mode*/ 8) set_data(t6, /*mode*/ ctx[3]);

    			if (dirty & /*canSubmit*/ 16 && button_disabled_value !== (button_disabled_value = !/*canSubmit*/ ctx[4])) {
    				button.disabled = button_disabled_value;
    			}

    			if (/*id*/ ctx[0]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					if_block.m(form, null);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(form);
    			if (if_block) if_block.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let mode;
    	let canSubmit;
    	let { id } = $$props;
    	let { order = "" } = $$props;
    	let { price } = $$props;

    	function submit() {
    		if (!canSubmit) {
    			return;
    		}

    		if (mode === "add") {
    			store$1.add(order, price);
    		}

    		if (mode === "edit") {
    			store$1.edit(id, order, price);
    		}

    		$$invalidate(0, id = undefined);
    		$$invalidate(1, order = "");
    		$$invalidate(2, price = "");
    	}

    	function cancel() {
    		$$invalidate(0, id = undefined);
    		$$invalidate(1, order = "");
    		$$invalidate(2, price = "");
    	}

    	function input0_input_handler() {
    		order = this.value;
    		$$invalidate(1, order);
    	}

    	function input1_input_handler() {
    		price = this.value;
    		$$invalidate(2, price);
    	}

    	$$self.$$set = $$props => {
    		if ("id" in $$props) $$invalidate(0, id = $$props.id);
    		if ("order" in $$props) $$invalidate(1, order = $$props.order);
    		if ("price" in $$props) $$invalidate(2, price = $$props.price);
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*id*/ 1) {
    			$$invalidate(3, mode = id ? "edit" : "add");
    		}

    		if ($$self.$$.dirty & /*price, order*/ 6) {
    			$$invalidate(4, canSubmit = price >= 0 && order);
    		}
    	};

    	return [
    		id,
    		order,
    		price,
    		mode,
    		canSubmit,
    		submit,
    		cancel,
    		input0_input_handler,
    		input1_input_handler
    	];
    }

    class Form extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { id: 0, order: 1, price: 2 });
    	}
    }

    /* src/App.svelte generated by Svelte v3.32.3 */

    function create_fragment$2(ctx) {
    	let main;
    	let h1;
    	let t1;
    	let p;
    	let t2;
    	let t3;
    	let form;
    	let updating_id;
    	let updating_order;
    	let updating_price;
    	let t4;
    	let table;
    	let updating_count;
    	let current;

    	function form_id_binding(value) {
    		/*form_id_binding*/ ctx[6](value);
    	}

    	function form_order_binding(value) {
    		/*form_order_binding*/ ctx[7](value);
    	}

    	function form_price_binding(value) {
    		/*form_price_binding*/ ctx[8](value);
    	}

    	let form_props = {};

    	if (/*id*/ ctx[1] !== void 0) {
    		form_props.id = /*id*/ ctx[1];
    	}

    	if (/*order*/ ctx[2] !== void 0) {
    		form_props.order = /*order*/ ctx[2];
    	}

    	if (/*price*/ ctx[3] !== void 0) {
    		form_props.price = /*price*/ ctx[3];
    	}

    	form = new Form({ props: form_props });
    	binding_callbacks.push(() => bind(form, "id", form_id_binding));
    	binding_callbacks.push(() => bind(form, "order", form_order_binding));
    	binding_callbacks.push(() => bind(form, "price", form_price_binding));

    	function table_count_binding(value) {
    		/*table_count_binding*/ ctx[9](value);
    	}

    	let table_props = {};

    	if (/*count*/ ctx[4] !== void 0) {
    		table_props.count = /*count*/ ctx[4];
    	}

    	table = new Table({ props: table_props });
    	binding_callbacks.push(() => bind(table, "count", table_count_binding));
    	table.$on("edit", /*edit*/ ctx[5]);

    	return {
    		c() {
    			main = element("main");
    			h1 = element("h1");
    			h1.textContent = "Svelte Estimator";
    			t1 = space();
    			p = element("p");
    			t2 = text(/*date*/ ctx[0]);
    			t3 = space();
    			create_component(form.$$.fragment);
    			t4 = space();
    			create_component(table.$$.fragment);
    			attr(main, "class", "svelte-1d4e8fi");
    		},
    		m(target, anchor) {
    			insert(target, main, anchor);
    			append(main, h1);
    			append(main, t1);
    			append(main, p);
    			append(p, t2);
    			append(main, t3);
    			mount_component(form, main, null);
    			append(main, t4);
    			mount_component(table, main, null);
    			current = true;
    		},
    		p(ctx, [dirty]) {
    			if (!current || dirty & /*date*/ 1) set_data(t2, /*date*/ ctx[0]);
    			const form_changes = {};

    			if (!updating_id && dirty & /*id*/ 2) {
    				updating_id = true;
    				form_changes.id = /*id*/ ctx[1];
    				add_flush_callback(() => updating_id = false);
    			}

    			if (!updating_order && dirty & /*order*/ 4) {
    				updating_order = true;
    				form_changes.order = /*order*/ ctx[2];
    				add_flush_callback(() => updating_order = false);
    			}

    			if (!updating_price && dirty & /*price*/ 8) {
    				updating_price = true;
    				form_changes.price = /*price*/ ctx[3];
    				add_flush_callback(() => updating_price = false);
    			}

    			form.$set(form_changes);
    			const table_changes = {};

    			if (!updating_count && dirty & /*count*/ 16) {
    				updating_count = true;
    				table_changes.count = /*count*/ ctx[4];
    				add_flush_callback(() => updating_count = false);
    			}

    			table.$set(table_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(form.$$.fragment, local);
    			transition_in(table.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(form.$$.fragment, local);
    			transition_out(table.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(main);
    			destroy_component(form);
    			destroy_component(table);
    		}
    	};
    }

    function showDate() {
    	let currentDate = new Date().toLocaleDateString();
    	return currentDate;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let id;
    	let order = "";
    	let price;
    	let count;

    	function edit(event) {
    		$$invalidate(1, { id, order, price } = event.detail, id, $$invalidate(2, order), $$invalidate(3, price));
    	}

    	let { date = showDate() } = $$props;

    	function form_id_binding(value) {
    		id = value;
    		$$invalidate(1, id);
    	}

    	function form_order_binding(value) {
    		order = value;
    		$$invalidate(2, order);
    	}

    	function form_price_binding(value) {
    		price = value;
    		$$invalidate(3, price);
    	}

    	function table_count_binding(value) {
    		count = value;
    		$$invalidate(4, count);
    	}

    	$$self.$$set = $$props => {
    		if ("date" in $$props) $$invalidate(0, date = $$props.date);
    	};

    	return [
    		date,
    		id,
    		order,
    		price,
    		count,
    		edit,
    		form_id_binding,
    		form_order_binding,
    		form_price_binding,
    		table_count_binding
    	];
    }

    class App extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { date: 0 });
    	}
    }

    const app = new App({
    	target: document.body,
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
