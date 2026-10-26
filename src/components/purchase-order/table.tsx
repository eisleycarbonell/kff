import { useMemo } from 'react';
import {
    MaterialReactTable,
    MRT_GlobalFilterTextField,
    MRT_ToggleFiltersButton,
    useMaterialReactTable,
    type MRT_ColumnDef,
} from 'material-react-table';
import { createTheme, ThemeProvider } from '@mui/material';
import { Box, Grid, Group, rem } from '@mantine/core';
import { CreateModal, EditDeleteModal } from './modal';
import { readLocalStorageValue, useIsomorphicEffect, useListState, useLocalStorage, useMounted } from '@mantine/hooks';

type PurchaseOrder = {
    supplierName: '',
    status: '',
    date: '',
    total: ''
};

const Table = ({feed}) => {
    const mounted = useMounted();
    const baseBackgroundColor = feed.theme.colorScheme === 'dark' ? 'rgba(36, 36, 36)' : 'rgba(255,255,255, 0.9)';
    const [data, handlers] = useListState<PurchaseOrder>();
    const [local, setLocal, removeValue] = useLocalStorage({
        key: 'purchaseOrderList',
        defaultValue: {list: []}
    });

    async function handleSave(param) {
        if(param){
            const readLocal: any = readLocalStorageValue({ key: 'purchaseOrderList' });
            handlers.setState(readLocal.list ?? [])
        }
    }

    useIsomorphicEffect(() => {
        handlers.setState(local.list)
    });

    const tableTheme = useMemo(
        () =>
            createTheme({
                palette: {
                    mode: feed.theme.colorScheme == 'dark' ? 'dark' : 'light'
                },
            }),
        [feed.theme],
    );

    const columns = useMemo<MRT_ColumnDef<PurchaseOrder>[]>(() => 
        [
            {
                accessorKey: 'id',
                header: 'Purchase ID',
            },
            {
                accessorKey: 'supplier',
                header: 'Supplier Name',
            },
            {
                accessorKey: 'status',
                header: 'Status',
            },
            {
                accessorKey: 'date',
                header: 'Date',
            },
            {
                accessorKey: 'total',
                header: 'Grand Total',
            },
        ],
        [],
    );

    const table = useMaterialReactTable({
        columns,
        data,
		enableRowActions: true,
        displayColumnDefOptions: {
            'mrt-row-actions': {
                header: '',
            },
        },
        initialState: {
            showGlobalFilter: true,
            columnVisibility: { 
                ['bom.code']: false,
                ['bom.name']: false,
                ['bom.qty']: false,
            }
        },
        mrtTheme: (theme) => ({
            baseBackgroundColor: baseBackgroundColor,
        }),
		renderTopToolbar: ({ table }) => (
            <Grid justify="flex-end" align="stretch" mt={rem(10)}>
                <Grid.Col span={8}>
                    <CreateModal feed={null} response={handleSave} />
                </Grid.Col>
                <Grid.Col span={4}>
                    <Group justify="flex-end" wrap="nowrap">
                        <MRT_GlobalFilterTextField table={table} />
                        <MRT_ToggleFiltersButton table={table} />
                    </Group>
                </Grid.Col>
            </Grid>
		),
		renderRowActions: ({ row, table }) => (
            <Box>
                <EditDeleteModal feed={row} response={handleSave}/>
            </Box>
		),
	});

    return (
        mounted ? 
        <ThemeProvider theme={tableTheme}>
            <MaterialReactTable table={table} />
        </ThemeProvider> 
        :
        <></>
    )
};

export default Table;
