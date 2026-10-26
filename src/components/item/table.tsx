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

type Item = {
    code: String,
    name: String,
    type: String,
    uom: String,
    qty: String,
    bom: {
        code: String,
        name: String,
        qty: String,
    },
    status: String,
    date: String
};

const Table = ({feed}) => {
    const mounted = useMounted();
    const baseBackgroundColor = feed.theme.colorScheme === 'dark' ? 'rgba(36, 36, 36)' : 'rgba(255,255,255, 0.9)';
    const [data, handlers] = useListState<Item>();
    const [local, setLocal, removeValue] = useLocalStorage({
        key: 'itemList',
        defaultValue: {list: []}
    });

    async function handleSave(param) {
        if(param){
            const readLocal: any = readLocalStorageValue({ key: 'supplierList' });
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

    const columns = useMemo<MRT_ColumnDef<Item>[]>(() => 
        [
            {
                accessorKey: 'code',
                header: 'Code',
            },
            {
                accessorKey: 'name',
                header: 'Name',
            },
            {
                accessorKey: 'type',
                header: 'Type',
            },
            {
                accessorKey: 'uom',
                header: 'UoM',
            },
            {
                accessorKey: 'qty',
                header: 'Quality',
            },
            {
                accessorKey: 'bom.code',
                header: '',
            },
            {
                accessorKey: 'bom.name',
                header: '',
            },
            {
                accessorKey: 'bom.qty',
                header: '',
            },
            {
                accessorKey: 'status',
                header: 'Status',
            },
            {
                accessorKey: 'rate',
                header: 'Rate',
            },
            {
                accessorKey: 'date',
                header: 'Date',
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
