import { useMemo } from 'react';
import {
    MaterialReactTable,
    useMaterialReactTable,
    type MRT_ColumnDef,
} from 'material-react-table';
import { createTheme, ThemeProvider } from '@mui/material';
import { useMantineColorScheme } from '@mantine/core';

type PurchaseOrder = {
    supplierName: '',
    itemCode: '',
    qty: '',
    status: '',
    date: '',
    total: ''
};

const data: PurchaseOrder[] = [
    {
        supplierName: '',
        itemCode: '',
        qty: '',
        status: '',
        date: '',
        total: ''
    },
    {
        supplierName: '',
        itemCode: '',
        qty: '',
        status: '',
        date: '',
        total: ''
    },
];

const table = ({feed}) => {

    const baseBackgroundColor =
    feed.theme.colorScheme === 'dark'
      ? 'rgba(36, 36, 36)'
      : 'rgba(255,255,255, 0.9)';

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
                accessorKey: 'suppierName',
                header: 'Supplier',
                size: 150,
            },
            {
                accessorKey: 'itemCode',
                header: 'Item Code',
                size: 150,
            },
            {
                accessorKey: 'qty',
                header: 'Quantity',
                size: 150,
            },
            {
                accessorKey: 'status',
                header: 'Status',
                size: 150,
            },
            {
                accessorKey: 'date',
                header: 'Date',
                size: 200,
            },
            {
                accessorKey: 'total',
                header: 'Grand Total',
                size: 150,
            },
        ],
        [],
    );

    const table = useMaterialReactTable({
        columns,
        data,
        mrtTheme: (theme) => ({
            baseBackgroundColor: baseBackgroundColor,
        }),
    });

    return (
        <ThemeProvider theme={tableTheme}>
            <MaterialReactTable table={table} />
        </ThemeProvider>
    )
};

export default table;
