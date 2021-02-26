<script>
  import store from '../utils/store.js'
  export let id
  export let order = ''
  export let price

  $: mode = id ? 'edit' : 'add'
  $: canSubmit = price >= 0 && order

  function submit() {
    if (!canSubmit) {
      return
    }

    if (mode === 'add') {
      store.add(order, price)
    }

    if (mode === 'edit') {
      store.edit(id, order, price)
    }

    id = undefined
    order = ''
    price = ''
  }

  function cancel() {
    id = undefined
    order = ''
    price = ''
  }
</script>

<style>
  button {
    margin-left: 1rem;
  }

  button:disabled {
    cursor: not-allowed;
  }
</style>

<!-- svelte特性可以直接添加在此 -->
<form on:submit|preventDefault={submit}>
  <fieldset>
    <label for="order">Order Item</label>
    <input
      bind:value={order}
      type="text"
      name="order"
      id="order"
      placeholder="Please enter your order item!"
    >

    <label for="price">Price per unit</label>
    <input
      bind:value={price}
      min="0"
      step="any"
      type="text"
      name="price"
      id="price"
      placeholder="Please enter your price!"
    >
  </fieldset>
  <button
    disabled={!canSubmit}
    class="float-right"
    type="submit"
  >
    {mode}
  </button>
  {#if id}
    <button
      on:click={cancel}
      class="float-right"
      type="button"
    >
      cancel
    </button>
  {/if}
</form>