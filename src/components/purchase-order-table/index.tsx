import { useMemo } from 'react';
import {
    MaterialReactTable,
    useMaterialReactTable,
    type MRT_ColumnDef,
} from 'material-react-table';
import { createTheme, ThemeProvider } from '@mui/material';
import { useMantineColorScheme } from '@mantine/core';

type Person = {
    name: {
        firstName: string;
        lastName: string;
    };
    address: string;
    city: string;
    state: string;
};

const data: Person[] = [
    {
        name: {
        firstName: 'John',
        lastName: 'Doe',
        },
        address: '261 Erdman Ford',
        city: 'East Daphne',
        state: 'Kentucky',
    },
    {
        name: {
        firstName: 'Jane',
        lastName: 'Doe',
        },
        address: '769 Dominic Grove',
        city: 'Columbus',
        state: 'Ohio',
    },
    {
        name: {
        firstName: 'Joe',
        lastName: 'Doe',
        },
        address: '566 Brakus Inlet',
        city: 'South Linda',
        state: 'West Virginia',
    },
    {
        name: {
        firstName: 'Kevin',
        lastName: 'Vandy',
        },
        address: '722 Emie Stream',
        city: 'Lincoln',
        state: 'Nebraska',
    },
    {
        name: {
        firstName: 'Joshua',
        lastName: 'Rolluffs',
        },
        address: '32188 Larkin Turnpike',
        city: 'Omaha',
        state: 'Nebraska',
    },
];

const table = ({feed}) => {
    console.log(feed)

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

    const columns = useMemo<MRT_ColumnDef<Person>[]>(() => 
        [
            {
                accessorKey: 'name.firstName',
                header: 'Supplier',
                size: 150,
            },
            {
                accessorKey: 'name.lastName',
                header: 'Status',
                size: 150,
            },
            {
                accessorKey: 'Date',
                header: 'Date',
                size: 200,
            },
            {
                accessorKey: 'Grand Total',
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
