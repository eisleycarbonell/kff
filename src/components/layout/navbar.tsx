import { useState } from 'react';
import { IconChartBar, 
    IconReport, 
    IconPackageImport, 
    IconPackages, 
    IconAssembly, 
    IconPackageExport,
    IconInfoCircle,
    IconSettings,
    IconChevronRight } from '@tabler/icons-react';
import { Box, NavLink, ScrollArea } from '@mantine/core';
import classes from '@/styles/layout.module.css';
import { useRouter } from 'next/router'

const data = [
    { icon: IconChartBar, label: 'Dashboard', link: '/dashboard' },
    {
        icon: IconPackageImport,
        label: 'Buying',
        rightSection: <IconChevronRight size="1rem" stroke={1.5} />,
        link: '#',
        child: [
            { label: 'Purchase Order', link: '/purchase-order' },
            { label: 'Supplier', link: '/supplier' },
        ],
    },
    {
        icon: IconPackages,
        label: 'Stocks',
        rightSection: <IconChevronRight size="1rem" stroke={1.5} />,
        link: '#',
        child: [
            { label: 'Items', link: '/items' },
            { label: 'Material Request', link: '/material-request' },
            { label: 'Warehouse', link: '/warehouse' },
            { label: 'Brand', link: '/brand' },
        ],
    },
    {
        icon: IconAssembly,
        label: 'Manufacturing',
        rightSection: <IconChevronRight size="1rem" stroke={1.5} />,
        link: '#',
        child: [
            { label: 'Operation', link: '/operation' },
            { label: 'Routing', link: '#' },
        ],
    },
    {
        icon: IconPackageExport,
        label: 'Selling',
        rightSection: <IconChevronRight size="1rem" stroke={1.5} />,
        link: '#',
        child: [
            { label: 'Customers', link: 'customers' },
            { label: 'Routing', link: '#' },
        ],
    },
    {
        icon: IconReport,
        label: 'Reports',
        rightSection: <IconChevronRight size="1rem" stroke={1.5} />,
        link: '#',
        child: [
            { label: 'Purchase Order Analysis', link: '/purchase-order-analysis' },
            { label: 'Sales Order Analysis', link: '/sales-order-analysis' },
            { label: 'Stock Analytics', link: '/stock-analytics' },
        ],
    },
    { icon: IconInfoCircle, label: 'About', link: '/about' },
    { icon: IconSettings, label: 'Settings', link: '/settings' },
];

export default function Navbar() {
    const router = useRouter()
    const [active, setActive] = useState('');
    const [childOpen, setChildOpen] = useState(false);

    function getLink(item){
        router.push(item.link)
        setActive(item.label)
    }

    const items = data.map((item, index) => (
        <NavLink
            key={item.label}
            active={item.label === active}
            label={item.label}
            rightSection={item.rightSection}
            leftSection={<item.icon size="1rem" stroke={1.5} />}
            onClick={() => getLink(item)}
            variant="subtle"
            defaultOpened={childOpen}
            color="green"
        >
            {item.child?.map((item, index) => (
                <NavLink
                    className={classes.link}
                    key={item.label}
                    active={item.label === active}
                    label={item.label}
                    onClick={() => getLink(item)}
                    variant="subtle"
                    color="green"
                />
            ))}
        </NavLink>
    ));

    return (
        <ScrollArea.Autosize>
            {items}
        </ScrollArea.Autosize>
    )
}