import { useDisclosure, useLocalStorage, useSetState } from '@mantine/hooks';
import { Modal, Button, Container, Grid, TextInput, Group, ActionIcon, Select} from '@mantine/core';
import { IconPencil, IconTrash } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

export function CreateModal({feed,response}) {
  	const [opened, { open, close }] = useDisclosure(false, {
		onOpen: () => {
			setState({
				name: '',
				type: '',
			})
		}
	});
	const [state, setState] = useSetState<any|null>({
		name: '',
		type: '',
		status: 'Enable',
		date: '00/00/0000'
	});
	const [local, setLocal] = useLocalStorage({
		key: 'supplierList',
		defaultValue: {list: []},
	});

	function save(){
		let arr: any = local.list
		arr.push(state)
		setLocal({list: arr})
		response(true)
		notifications.show({
			title: 'Success',
			message: 'Supplier has been created',
			color: 'green'
		})
		close();
	}

	return (
		<Container fluid>
			<Modal opened={opened} onClose={close} title="Create Supplier">
				<Grid>
					<Grid.Col span={12}>
						<TextInput
							label="Name"
							withAsterisk
							placeholder=""
							value={state.name}
							onChange={(event) => setState({ name: event.currentTarget.value })}
						/>
					</Grid.Col>
					<Grid.Col span={12}>
						<Select 
							label="Type" 
							withAsterisk 
							data={[
								'Distributor',
								'Service',
								'Manufacturer',
								'Importer',
							]} 
							value={state.type} 
							onChange={(option) => setState({ type: option })} 
						/>
					</Grid.Col>
					<Grid.Col span={6}>
						<Button onClick={save} variant="outline" radius="md" color='green' mt={25} fullWidth>SAVE</Button>
					</Grid.Col>
					<Grid.Col span={6}>
						<Button onClick={close} variant="outline" radius="md" color='red' mt={25} fullWidth>CANCEL</Button>
					</Grid.Col>
				</Grid>
			</Modal>
			<Button onClick={open} variant="outline" radius="md" color='green'>Create New Supplier</Button>
		</Container>
	);
}

export function EditDeleteModal({feed,response}) {
	const [opened, { open, close }] = useDisclosure(false);
	const [state, setState] = useSetState({
		name: feed.original.name,
		type: feed.original.type,
		status: feed.original.status,
		date: '00/00/0000'
	});
	const [local, setLocal] = useLocalStorage<any>({
		key: 'supplierList',
		defaultValue: {list: []},
	});

	function save(){
		let arr: any = local.list
		const index = arr.findIndex(obj => obj.name == feed.original.name);
		arr[index].name = state.name
		arr[index].type = state.type
		setLocal({list: arr})
		response(true)
		notifications.show({
			title: 'Success',
			message: 'Supplier has been updated',
			color: 'green'
		})
		close();
	}

	function deleteRow() {
		let arr: any = local.list
		arr = arr.filter(item => item.name !== feed.original.name)
		setLocal({list: arr})
		response(true)
		notifications.show({
			title: 'Success',
			message: 'Supplier has been deleted',
			color: 'green'
		})
	}

	return (
		<Container fluid>
			<Modal opened={opened} onClose={close} title="Update Supplier">
				<Grid>
					<Grid.Col span="content">
						{/* <Box>
							<Switch
								label="Status"
								checked={state.status}
								size="sm"
								color="green"
								onLabel="ON" 
								offLabel="OFF"
								onChange={(event) => setState({ status: event.currentTarget.checked })}
							/>
						</Box> */}
					</Grid.Col>
					<Grid.Col span={12}>
						<TextInput
							label="Supplier Name"
							withAsterisk
							placeholder=""
							value={state.name}
							onChange={(event) => setState({ name: event.currentTarget.value })}
						/>
					</Grid.Col>
					<Grid.Col span={12}>
						<Select 
							label="Type" 
							withAsterisk 
							data={[
								'Distributor',
								'Service',
								'Manufacturer',
								'Importer',
							]} 
							value={state.type} 
							onChange={(option) => setState({ type: option })} 
						/>
					</Grid.Col>
					<Grid.Col span={6}>
						<Button onClick={save} variant="outline" radius="md" color='green' mt={25} fullWidth>SAVE</Button>
					</Grid.Col>
					<Grid.Col span={6}>
						<Button onClick={close} variant="outline" radius="md" color='red' mt={25} fullWidth>CANCEL</Button>
					</Grid.Col>
				</Grid>
			</Modal>

			<Group wrap="nowrap">
				<ActionIcon 
					variant="transparent" 
					color='green'
					onClick={open}
				>
					<IconPencil stroke={1.5} />
				</ActionIcon>
				<ActionIcon 
					variant="transparent"
					onClick={deleteRow}
				>
					<IconTrash color='red' stroke={1.5} />
				</ActionIcon>
			</Group>
		</Container>
	);
}