
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
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
    function validate_each_keys(ctx, list, get_context, get_key) {
        const keys = new Set();
        for (let i = 0; i < list.length; i++) {
            const key = get_key(get_context(ctx, list, i));
            if (keys.has(key)) {
                throw new Error('Cannot have duplicate keys in a keyed each');
            }
            keys.add(key);
        }
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

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.32.3' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function prop_dev(node, property, value) {
        node[property] = value;
        dispatch_dev('SvelteDOMSetProperty', { node, property, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
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
    const file = "src/components/Table.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[9] = list[i];
    	child_ctx[10] = list;
    	child_ctx[11] = i;
    	return child_ctx;
    }

    // (89:4) {#each orders as order (order.id)}
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

    	const block = {
    		key: key_1,
    		first: null,
    		c: function create() {
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
    			add_location(td0, file, 90, 6, 1701);
    			add_location(td1, file, 91, 6, 1730);
    			attr_dev(div0, "class", "two columns svelte-1ynae2t");
    			attr_dev(div0, "type", "button");
    			add_location(div0, file, 93, 8, 1814);
    			attr_dev(input, "class", "count-input svelte-1ynae2t");
    			attr_dev(input, "min", "1");
    			attr_dev(input, "step", "any");
    			attr_dev(input, "type", "text");
    			attr_dev(input, "name", "count");
    			add_location(input, file, 100, 8, 1982);
    			attr_dev(div1, "class", "two columns svelte-1ynae2t");
    			attr_dev(div1, "type", "button");
    			add_location(div1, file, 108, 8, 2156);
    			attr_dev(td2, "class", "button-box svelte-1ynae2t");
    			add_location(td2, file, 92, 6, 1782);
    			attr_dev(i, "class", "far fa-trash-alt");
    			add_location(i, file, 117, 8, 2347);
    			add_location(td3, file, 116, 6, 2334);
    			attr_dev(tr, "class", "order svelte-1ynae2t");
    			add_location(tr, file, 89, 4, 1611);
    			this.first = tr;
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, tr, anchor);
    			append_dev(tr, td0);
    			append_dev(td0, t0);
    			append_dev(tr, t1);
    			append_dev(tr, td1);
    			append_dev(td1, t2);
    			append_dev(tr, t3);
    			append_dev(tr, td2);
    			append_dev(td2, div0);
    			append_dev(td2, t5);
    			append_dev(td2, input);
    			set_input_value(input, /*order*/ ctx[9].count);
    			append_dev(td2, t6);
    			append_dev(td2, div1);
    			append_dev(tr, t8);
    			append_dev(tr, td3);
    			append_dev(td3, i);

    			if (!mounted) {
    				dispose = [
    					listen_dev(
    						div0,
    						"click",
    						stop_propagation(function () {
    							if (is_function(/*minus*/ ctx[5](/*order*/ ctx[9].id, /*order*/ ctx[9].count))) /*minus*/ ctx[5](/*order*/ ctx[9].id, /*order*/ ctx[9].count).apply(this, arguments);
    						}),
    						false,
    						false,
    						true
    					),
    					listen_dev(input, "input", input_input_handler),
    					listen_dev(
    						div1,
    						"click",
    						stop_propagation(function () {
    							if (is_function(/*add*/ ctx[6](/*order*/ ctx[9].id, /*order*/ ctx[9].count))) /*add*/ ctx[6](/*order*/ ctx[9].id, /*order*/ ctx[9].count).apply(this, arguments);
    						}),
    						false,
    						false,
    						true
    					),
    					listen_dev(
    						i,
    						"click",
    						stop_propagation(function () {
    							if (is_function(/*remove*/ ctx[4](/*order*/ ctx[9].id))) /*remove*/ ctx[4](/*order*/ ctx[9].id).apply(this, arguments);
    						}),
    						false,
    						false,
    						true
    					),
    					listen_dev(
    						tr,
    						"click",
    						function () {
    							if (is_function(/*edit*/ ctx[3](/*order*/ ctx[9].id, /*order*/ ctx[9].order, /*order*/ ctx[9].price, /*order*/ ctx[9].count))) /*edit*/ ctx[3](/*order*/ ctx[9].id, /*order*/ ctx[9].order, /*order*/ ctx[9].price, /*order*/ ctx[9].count).apply(this, arguments);
    						},
    						false,
    						false,
    						false
    					)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty & /*orders*/ 1 && t0_value !== (t0_value = /*order*/ ctx[9].order + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*orders*/ 1 && t2_value !== (t2_value = /*currencyFormat*/ ctx[2].format(/*order*/ ctx[9].price) + "")) set_data_dev(t2, t2_value);

    			if (dirty & /*orders*/ 1 && input.value !== /*order*/ ctx[9].count) {
    				set_input_value(input, /*order*/ ctx[9].count);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(tr);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(89:4) {#each orders as order (order.id)}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let table;
    	let thead;
    	let tr0;
    	let th0;
    	let t1;
    	let th1;
    	let t3;
    	let th2;
    	let t5;
    	let th3;
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
    	validate_each_argument(each_value);
    	const get_key = ctx => /*order*/ ctx[9].id;
    	validate_each_keys(ctx, each_value, get_each_context, get_key);

    	for (let i = 0; i < each_value.length; i += 1) {
    		let child_ctx = get_each_context(ctx, each_value, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block(key, child_ctx));
    	}

    	const block = {
    		c: function create() {
    			table = element("table");
    			thead = element("thead");
    			tr0 = element("tr");
    			th0 = element("th");
    			th0.textContent = "Item";
    			t1 = space();
    			th1 = element("th");
    			th1.textContent = "Price";
    			t3 = space();
    			th2 = element("th");
    			th2.textContent = "Count";
    			t5 = space();
    			th3 = element("th");
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
    			add_location(th0, file, 81, 6, 1468);
    			add_location(th1, file, 82, 6, 1488);
    			add_location(th2, file, 83, 6, 1509);
    			add_location(th3, file, 84, 6, 1530);
    			add_location(tr0, file, 80, 4, 1457);
    			add_location(thead, file, 79, 2, 1445);
    			add_location(td0, file, 125, 6, 2499);
    			attr_dev(td1, "colspan", "3");
    			add_location(td1, file, 126, 6, 2520);
    			add_location(tr1, file, 124, 4, 2488);
    			add_location(tbody, file, 87, 2, 1560);
    			attr_dev(table, "class", "primary svelte-1ynae2t");
    			add_location(table, file, 78, 0, 1419);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, table, anchor);
    			append_dev(table, thead);
    			append_dev(thead, tr0);
    			append_dev(tr0, th0);
    			append_dev(tr0, t1);
    			append_dev(tr0, th1);
    			append_dev(tr0, t3);
    			append_dev(tr0, th2);
    			append_dev(tr0, t5);
    			append_dev(tr0, th3);
    			append_dev(table, t6);
    			append_dev(table, tbody);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(tbody, null);
    			}

    			append_dev(tbody, t7);
    			append_dev(tbody, tr1);
    			append_dev(tr1, td0);
    			append_dev(tr1, t9);
    			append_dev(tr1, td1);
    			append_dev(td1, t10);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*edit, orders, remove, add, minus, currencyFormat*/ 125) {
    				each_value = /*orders*/ ctx[0];
    				validate_each_argument(each_value);
    				validate_each_keys(ctx, each_value, get_each_context, get_key);
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, tbody, destroy_block, create_each_block, t7, get_each_context);
    			}

    			if (dirty & /*total*/ 2 && t10_value !== (t10_value = /*currencyFormat*/ ctx[2].format(/*total*/ ctx[1]) + "")) set_data_dev(t10, t10_value);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(table);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d();
    			}
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let total;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Table", slots, []);
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
    		count = Number(count);

    		if (count === 0) {
    			count = 1;
    		}

    		if (count > 1) {
    			count -= 1;
    			store$1.changeCount(id, count);
    		}
    	}

    	function add(id, count) {
    		count = Number(count);

    		if (count === 0) {
    			count = 1;
    		}

    		count += 1;
    		store$1.changeCount(id, count);
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Table> was created with unknown prop '${key}'`);
    	});

    	function input_input_handler(each_value, order_index) {
    		each_value[order_index].count = this.value;
    		$$invalidate(0, orders);
    	}

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		store: store$1,
    		dispatch,
    		orders,
    		currencyFormat,
    		edit,
    		remove,
    		minus,
    		add,
    		total
    	});

    	$$self.$inject_state = $$props => {
    		if ("orders" in $$props) $$invalidate(0, orders = $$props.orders);
    		if ("total" in $$props) $$invalidate(1, total = $$props.total);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
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

    class Table extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Table",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    /* src/components/Form.svelte generated by Svelte v3.32.3 */
    const file$1 = "src/components/Form.svelte";

    // (75:2) {#if id}
    function create_if_block(ctx) {
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			button = element("button");
    			button.textContent = "cancel";
    			attr_dev(button, "class", "float-right svelte-rsh4tk");
    			attr_dev(button, "type", "button");
    			add_location(button, file$1, 75, 4, 1242);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*cancel*/ ctx[6], false, false, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(75:2) {#if id}",
    		ctx
    	});

    	return block;
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

    	const block = {
    		c: function create() {
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
    			attr_dev(label0, "for", "order");
    			add_location(label0, file$1, 47, 4, 705);
    			attr_dev(input0, "type", "text");
    			attr_dev(input0, "name", "order");
    			attr_dev(input0, "id", "order");
    			attr_dev(input0, "placeholder", "Please enter your order item!");
    			add_location(input0, file$1, 48, 4, 747);
    			attr_dev(label1, "for", "price");
    			add_location(label1, file$1, 56, 4, 894);
    			attr_dev(input1, "min", "0");
    			attr_dev(input1, "step", "any");
    			attr_dev(input1, "type", "text");
    			attr_dev(input1, "name", "price");
    			attr_dev(input1, "id", "price");
    			attr_dev(input1, "placeholder", "Please enter your price!");
    			add_location(input1, file$1, 57, 4, 940);
    			add_location(fieldset, file$1, 46, 2, 690);
    			button.disabled = button_disabled_value = !/*canSubmit*/ ctx[4];
    			attr_dev(button, "class", "float-right svelte-rsh4tk");
    			attr_dev(button, "type", "submit");
    			add_location(button, file$1, 67, 2, 1124);
    			add_location(form, file$1, 45, 0, 647);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, form, anchor);
    			append_dev(form, fieldset);
    			append_dev(fieldset, label0);
    			append_dev(fieldset, t1);
    			append_dev(fieldset, input0);
    			set_input_value(input0, /*order*/ ctx[1]);
    			append_dev(fieldset, t2);
    			append_dev(fieldset, label1);
    			append_dev(fieldset, t4);
    			append_dev(fieldset, input1);
    			set_input_value(input1, /*price*/ ctx[2]);
    			append_dev(form, t5);
    			append_dev(form, button);
    			append_dev(button, t6);
    			append_dev(form, t7);
    			if (if_block) if_block.m(form, null);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "input", /*input0_input_handler*/ ctx[7]),
    					listen_dev(input1, "input", /*input1_input_handler*/ ctx[8]),
    					listen_dev(form, "submit", prevent_default(/*submit*/ ctx[5]), false, true, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*order*/ 2 && input0.value !== /*order*/ ctx[1]) {
    				set_input_value(input0, /*order*/ ctx[1]);
    			}

    			if (dirty & /*price*/ 4 && input1.value !== /*price*/ ctx[2]) {
    				set_input_value(input1, /*price*/ ctx[2]);
    			}

    			if (dirty & /*mode*/ 8) set_data_dev(t6, /*mode*/ ctx[3]);

    			if (dirty & /*canSubmit*/ 16 && button_disabled_value !== (button_disabled_value = !/*canSubmit*/ ctx[4])) {
    				prop_dev(button, "disabled", button_disabled_value);
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
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(form);
    			if (if_block) if_block.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let mode;
    	let canSubmit;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Form", slots, []);
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

    	const writable_props = ["id", "order", "price"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Form> was created with unknown prop '${key}'`);
    	});

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

    	$$self.$capture_state = () => ({
    		store: store$1,
    		id,
    		order,
    		price,
    		submit,
    		cancel,
    		mode,
    		canSubmit
    	});

    	$$self.$inject_state = $$props => {
    		if ("id" in $$props) $$invalidate(0, id = $$props.id);
    		if ("order" in $$props) $$invalidate(1, order = $$props.order);
    		if ("price" in $$props) $$invalidate(2, price = $$props.price);
    		if ("mode" in $$props) $$invalidate(3, mode = $$props.mode);
    		if ("canSubmit" in $$props) $$invalidate(4, canSubmit = $$props.canSubmit);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

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

    class Form extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { id: 0, order: 1, price: 2 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Form",
    			options,
    			id: create_fragment$1.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*id*/ ctx[0] === undefined && !("id" in props)) {
    			console.warn("<Form> was created without expected prop 'id'");
    		}

    		if (/*price*/ ctx[2] === undefined && !("price" in props)) {
    			console.warn("<Form> was created without expected prop 'price'");
    		}
    	}

    	get id() {
    		throw new Error("<Form>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set id(value) {
    		throw new Error("<Form>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get order() {
    		throw new Error("<Form>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set order(value) {
    		throw new Error("<Form>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get price() {
    		throw new Error("<Form>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set price(value) {
    		throw new Error("<Form>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/App.svelte generated by Svelte v3.32.3 */
    const file$2 = "src/App.svelte";

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

    	form = new Form({ props: form_props, $$inline: true });
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

    	table = new Table({ props: table_props, $$inline: true });
    	binding_callbacks.push(() => bind(table, "count", table_count_binding));
    	table.$on("edit", /*edit*/ ctx[5]);

    	const block = {
    		c: function create() {
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
    			add_location(h1, file$2, 32, 1, 492);
    			add_location(p, file$2, 33, 1, 519);
    			attr_dev(main, "class", "svelte-1d4e8fi");
    			add_location(main, file$2, 31, 0, 484);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, h1);
    			append_dev(main, t1);
    			append_dev(main, p);
    			append_dev(p, t2);
    			append_dev(main, t3);
    			mount_component(form, main, null);
    			append_dev(main, t4);
    			mount_component(table, main, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (!current || dirty & /*date*/ 1) set_data_dev(t2, /*date*/ ctx[0]);
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
    		i: function intro(local) {
    			if (current) return;
    			transition_in(form.$$.fragment, local);
    			transition_in(table.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(form.$$.fragment, local);
    			transition_out(table.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			destroy_component(form);
    			destroy_component(table);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function showDate() {
    	let currentDate = new Date().toLocaleDateString();
    	return currentDate;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("App", slots, []);
    	let id;
    	let order = "";
    	let price;
    	let count;

    	function edit(event) {
    		$$invalidate(1, { id, order, price } = event.detail, id, $$invalidate(2, order), $$invalidate(3, price));
    	}

    	let { date = showDate() } = $$props;
    	const writable_props = ["date"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<App> was created with unknown prop '${key}'`);
    	});

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

    	$$self.$capture_state = () => ({
    		Table,
    		Form,
    		showDate,
    		id,
    		order,
    		price,
    		count,
    		edit,
    		date
    	});

    	$$self.$inject_state = $$props => {
    		if ("id" in $$props) $$invalidate(1, id = $$props.id);
    		if ("order" in $$props) $$invalidate(2, order = $$props.order);
    		if ("price" in $$props) $$invalidate(3, price = $$props.price);
    		if ("count" in $$props) $$invalidate(4, count = $$props.count);
    		if ("date" in $$props) $$invalidate(0, date = $$props.date);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

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

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { date: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment$2.name
    		});
    	}

    	get date() {
    		throw new Error("<App>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set date(value) {
    		throw new Error("<App>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    const app = new App({
    	target: document.body,
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
