import { readLocalStorageValue, useDidUpdate, useDisclosure, useIsomorphicEffect, useListState, useLocalStorage, useSet, useSetState } from '@mantine/hooks';
import { Modal, Button, Container, Grid, TextInput, Group, ActionIcon, Select, NumberInput, MultiSelect, Table, Divider, Title, FileButton, FileInput, TableData, NumberFormatter} from '@mantine/core';
import { IconPencil, IconTrash } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useState } from 'react';

export function CreateModal({feed,response}) {
	const readLocalSupplier: any = readLocalStorageValue({ key: 'supplierList' });
    const readLocaItem: any = readLocalStorageValue({ key: 'itemList' });
	const scopeSupplier = useSet<any>([]);
	const scopeItem = useSet<any>([]);
	const [values, handlers] = useListState<any>();
	const [local, setLocal] = useLocalStorage<any>({key:'purchaseOrderList',defaultValue:{list:[]}});
	const [purchaseOrderState, setPurchaseOrderState] = useSetState<any|null>({});
	const [materialRequeststate, setMaterialRequestState] = useSetState<any|null>({});
  	const [opened, { open, close }] = useDisclosure(false, {
		onOpen: () => {
			setPurchaseOrderState({
				supplier: '',
				requiredBy: '',
				qty: '',
				status: '',
				date: '00/00/0000',
				total: 0,
			})
			readLocalSupplier?.list.forEach((element) => scopeSupplier.add(element.name));
            
		}
	});
	const rows = values.map((element,index) => {
		return (
            <Table.Tr
            key={element.code}
            >
                <Table.Td>
                    <ActionIcon 
                        variant="transparent"
                        onClick={() => deleteRaw(index)}
                    >
                        <IconTrash color='red' stroke={1.5} />
                    </ActionIcon>
                </Table.Td>
                <Table.Td>{element.code}</Table.Td>
                <Table.Td>{element.name}</Table.Td>
                <Table.Td>{element.qty}</Table.Td>
                <Table.Td>{element.rate}</Table.Td>
            </Table.Tr>
        )
	});

	function save(){
		let arr: any = local.list
		arr.push(purchaseOrderState)
		setLocal({list: arr})
		response(true)
		notifications.show({
			title: 'Success',
			message: 'Item has been created',
			color: 'green'
		})
		close();
	}

	function add(){
		const found = readLocaItem.list.find((element) => element.code == materialRequeststate.code);
		handlers.prepend({
			code:materialRequeststate.code,
            name:found.name,
			qty:materialRequeststate.qty,
            rate:found.rate
		})
        setPurchaseOrderState({total:found.rate})
		notifications.show({
			title: 'Success',
			message: 'Item has been created',
			color: 'green'
		})
	}

	function deleteRaw(param) {
		handlers.remove(param);
	}

	useDidUpdate(
		() => 
        readLocaItem?.list.forEach((element) => {
            if(element.type == 'Raw materials' && element.supplier == purchaseOrderState.supplier){
                scopeItem.add(element.code);
            } else {
                scopeItem.delete(element.code);
            }
        }),
		[purchaseOrderState.supplier]
	);

	useIsomorphicEffect(() => {
	});

	return (
		<Container fluid>
			<Modal opened={opened} onClose={close} size={'xl'} title="Create Purchase Order">
				<Container>
					<Grid>
                        <Grid.Col span={6}>
							<Select
								label="Supplier" 
								withAsterisk 
								data={Array.from(scopeSupplier)} 
								value={purchaseOrderState.supplier} 
								onChange={(option) => setPurchaseOrderState({ supplier: option })} 
							/>
						</Grid.Col>
						<Grid.Col span={6}>
							<TextInput
								label="Required By"
								withAsterisk
								placeholder=""
								value={purchaseOrderState.requiredBy}
								onChange={(event) => setPurchaseOrderState({ requiredBy: event.currentTarget.value })}
							/>
						</Grid.Col>
						<Grid.Col span={4}>
							<Select
								label="Status" 
								withAsterisk 
								data={[
									'Enable',
									'Disable',
									'Draft',
								]} 
								value={purchaseOrderState.status} 
								onChange={(option) => setPurchaseOrderState({ status: option })} 
							/>
						</Grid.Col>
                        <Grid.Col span={4}>
                            <Select
								label="Set Target Warehouse" 
								withAsterisk 
								data={[
									'Warehouse1',
									'Warehouse2',
									'Warehouse3',
								]} 
								value={purchaseOrderState.status} 
								onChange={(option) => setPurchaseOrderState({ status: option })} 
							/>
						</Grid.Col>
						<Grid.Col span={4}>
							<NumberInput
								label="Grand Total"
								withAsterisk
								min={0}
								prefix="₱ "
								thousandSeparator=","
								value={purchaseOrderState.total} 
                                readOnly
							/>
						</Grid.Col>
                        <Grid.Col span={12}>
                            <Divider my="xs" label="" labelPosition="center" />
                            <Group justify="space-between">
                                <Title order={5}>Items</Title>
                                <Button onClick={add} size='xs' variant="outline" color="green">ADD</Button>
                            </Group>
                        </Grid.Col>
                        <Grid.Col span={6}>
                            <Select
                                label="Code" 
                                withAsterisk 
                                data={Array.from(scopeItem)} 
                                value={materialRequeststate.code} 
                                onChange={(option) => setMaterialRequestState({code: option})} 
                            />
                        </Grid.Col>
                        <Grid.Col span={6}>
                            <NumberInput
                                label="Quantity"
                                withAsterisk
                                min={0}
                                value={materialRequeststate.qty} 
                                onChange={(no) => setMaterialRequestState({qty: no })} 
                            />
                        </Grid.Col>
                        <Grid.Col span={12}>
                        <Table>
                            <Table.Thead>
                                <Table.Tr>
                                    <Table.Th></Table.Th>
                                    <Table.Th>Code</Table.Th>
                                    <Table.Th>Name</Table.Th>
                                    <Table.Th>Quantity</Table.Th>
                                    <Table.Th>Price</Table.Th>
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>{rows}</Table.Tbody>
                            </Table>
                        </Grid.Col>
						<Grid.Col span={6}>
							<Button onClick={save} variant="outline" radius="md" color='green' mt={25} fullWidth>SAVE</Button>
						</Grid.Col>
						<Grid.Col span={6}>
							<Button onClick={close} variant="outline" radius="md" color='red' mt={25} fullWidth>CANCEL</Button>
						</Grid.Col>
					</Grid>
				</Container>
			</Modal>
			<Button onClick={open} variant="outline" radius="md" color='green'>Create New Item</Button>
		</Container>
	);
}

export function EditDeleteModal({feed,response}) {
	const readLocalSupplier: any = readLocalStorageValue({ key: 'supplierList' });
	const scopeSupplier = useSet<any>([]);
	const scopeItem = useSet<any>([]);
	const [values, handlers] = useListState<any>();
	const [local, setLocal] = useLocalStorage<any>({key:'itemList',defaultValue:{list:[]}});
	const [itemState, setItemState] = useSetState<any|null>({});
	const [BOMstate, setBOMState] = useSetState<any|null>({});
  	const [opened, { open, close }] = useDisclosure(false, {
		onOpen: () => {
			setItemState({
				code: feed.original.code,
				name: feed.original.name,
				type: feed.original.type,
				uom: feed.original.uom,
				qty: feed.original.qty,
				supplier: feed.original.supplier,
				bom: feed.original.bom,
				status: feed.original.status,
				rate: feed.original.rate,
				date: feed.original.date
			})
			readLocalSupplier?.list.forEach((element) => scopeSupplier.add(element.name));
			local.list.forEach((element) => scopeItem.add(element.code));
		}
	});
	const rows = values.map((element,index) => (
		<Table.Tr
		  key={element.code}
		>
			<Table.Td>
				<ActionIcon 
					variant="transparent"
					onClick={() => deleteRaw(index)}
				>
					<IconTrash color='red' stroke={1.5} />
				</ActionIcon>
			</Table.Td>
			<Table.Td>{element.code}</Table.Td>
			<Table.Td>{element.name}</Table.Td>
			<Table.Td>{element.qty}</Table.Td>
			<Table.Td>{element.rate}</Table.Td>
			<Table.Td>{element.amount}</Table.Td>
		</Table.Tr>
	));

	function save(){
		let arr: any = local.list
		arr.push(itemState)
		setLocal({list: arr})
		response(true)
		notifications.show({
			title: 'Success',
			message: 'Item has been created',
			color: 'green'
		})
		close();
	}

	function add(){
		const found = local.list.find((element) => element.code == BOMstate.code);
		handlers.prepend({
			code:BOMstate.code,
			name:found.name,
			qty:BOMstate.qty,
			rate:found.rate,
			amount:found.rate*BOMstate.qty
		})
		notifications.show({
			title: 'Success',
			message: 'Item has been created',
			color: 'green'
		})
	}

	function deleteRaw(param) {
		handlers.remove(param);
	}

	useDidUpdate(
		() => setItemState({bom: values}),
		[values]
	);

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

	useIsomorphicEffect(() => {
	});

	return (
		<Container fluid>
			<Modal opened={opened} onClose={close} size={'xl'} title="Create Item">
				<Container>
					<Grid>
						<Grid.Col span={6}>
							<TextInput
								label="Code"
								withAsterisk
								placeholder=""
								value={itemState.code}
								onChange={(event) => setItemState({ code: event.currentTarget.value })}
							/>
						</Grid.Col>
						<Grid.Col span={6}>
							<TextInput
								label="Name"
								withAsterisk
								placeholder=""
								value={itemState.name}
								onChange={(event) => setItemState({ name: event.currentTarget.value })}
							/>
						</Grid.Col>
						<Grid.Col span={5}>
							<Select
								label="Type" 
								withAsterisk 
								data={[
									'Finished goods',
									'Raw materials',
									'Plastic label',
									'Box',
									'Inner Plastic',
								]} 
								value={itemState.type} 
								onChange={(option) => setItemState({ type: option })} 
							/>
						</Grid.Col>
						<Grid.Col span={4}>
							<Select
								label="UoM" 
								withAsterisk 
								data={[
									'Gram',
									'Kg',
									'Gallon',
									'Box',
									'Piece',
									'Dozen',
								]} 
								value={itemState.uom} 
								onChange={(option) => setItemState({ uom: option })} 
							/>
						</Grid.Col>
						<Grid.Col span={3}>
							<NumberInput
								label="Quantity"
								withAsterisk
								min={0}
								value={itemState.qty} 
								onChange={(no) => setItemState({ qty: no })} 
							/>
						</Grid.Col>
						<Grid.Col span={6}>
							<Select
								label="Supplier" 
								withAsterisk 
								data={Array.from(scopeSupplier)} 
								value={itemState.supplier} 
								onChange={(option) => setItemState({ supplier: option })} 
							/>
						</Grid.Col>
						<Grid.Col span={3}>
							<Select
								label="Status" 
								withAsterisk 
								data={[
									'Enable',
									'Disable',
									'Draft',
								]} 
								value={itemState.status} 
								onChange={(option) => setItemState({ status: option })} 
							/>
						</Grid.Col>
						<Grid.Col span={3}>
							<NumberInput
								label="Standard Selling Rate"
								withAsterisk
								min={0}
								prefix="₱ "
								thousandSeparator=","
								value={itemState.rate} 
								onChange={(no) => setItemState({ rate: no })} 
							/>
							{/* <FileInput accept="image/png,image/jpeg" label="Upload file" placeholder="Upload files" /> */}
						</Grid.Col>

						{itemState.type == 'Finished goods' ? 
							<>
								<Grid.Col span={12}>
									<Divider my="xs" label="Bills of Material" labelPosition="center" />
									<Group justify="space-between">
										<Title order={5}>Raw Materials</Title>
										<Button onClick={add} size='xs' variant="outline" color="green">ADD</Button>
									</Group>
								</Grid.Col>
								<Grid.Col span={6}>
									<Select
										label="Code" 
										withAsterisk 
										data={Array.from(scopeItem)} 
										value={BOMstate.code} 
										onChange={(option) => setBOMState({code: option})} 
									/>
									{itemState.bom.code}
								</Grid.Col>
								<Grid.Col span={6}>
									<NumberInput
										label="Quantity"
										withAsterisk
										min={0}
										value={BOMstate.qty} 
										onChange={(no) => setBOMState({qty: no })} 
									/>
								</Grid.Col>
								<Grid.Col span={12}>
								<Table>
									<Table.Thead>
										<Table.Tr>
											<Table.Th></Table.Th>
											<Table.Th>Code</Table.Th>
											<Table.Th>Name</Table.Th>
											<Table.Th>Quantity</Table.Th>
											<Table.Th>Rate</Table.Th>
											<Table.Th>Amount</Table.Th>
										</Table.Tr>
									</Table.Thead>
									<Table.Tbody>{rows}</Table.Tbody>
									</Table>
								</Grid.Col>
							</>
							:
							<></>
						}

						<Grid.Col span={6}>
							<Button onClick={save} variant="outline" radius="md" color='green' mt={25} fullWidth>SAVE</Button>
						</Grid.Col>
						<Grid.Col span={6}>
							<Button onClick={close} variant="outline" radius="md" color='red' mt={25} fullWidth>CANCEL</Button>
						</Grid.Col>
					</Grid>
				</Container>
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