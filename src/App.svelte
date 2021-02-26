<script>
	import Table from './components/Table.svelte'
	import Form from './components/Form.svelte'

	function showDate() {
		let currentDate = new Date().toLocaleDateString()
		return currentDate
	}

	let id
  let order = ''
  let price
	let count

	function edit(event) {
		({ id, order, price } = event.detail)
	}

	export let date = showDate()
</script>

<style>
	main {
		flex: 1;
		align-content: center;
		justify-content: center;
		width: 80%;
		margin: 0 auto;
	}
</style>

<main>
	<h1>Svelte Estimator</h1>
	<p>{date}</p>

	<Form bind:id bind:order bind:price />

	<Table bind:count on:edit={edit} />
</main>