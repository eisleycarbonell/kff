import { AppShell, Box, Burger, Group, Skeleton, Space, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import React from 'react';
import { ColorSchemeToggle } from '../colorSchemeToggle';
// import { Image } from '@mantine/core';
import Image from 'next/image'
import Navbar from './navbar'

export default function Layout({ children }) {
    const [mobileOpened, { toggle: toggleMobile }] = useDisclosure();
    const [desktopOpened, { toggle: toggleDesktop }] = useDisclosure(true);

    return (
        <AppShell
            header={{ height: 60 }}
            navbar={{
                width: 250,
                breakpoint: 'sm',
                collapsed: { mobile: !mobileOpened, desktop: !desktopOpened },
            }}
            padding="md"
        >
            <AppShell.Header>
                <Group h="100%" px="md" justify="space-between">
                    <Burger opened={mobileOpened} onClick={toggleMobile} hiddenFrom="sm" size="sm" />
                    <Burger opened={desktopOpened} onClick={toggleDesktop} visibleFrom="sm" size="sm" />
                    <Image
                        alt={'alt'}
                        src={`/logo.png`}
                        width="100" 
                        height="45"
                    />
                    <ColorSchemeToggle />
                </Group>
            </AppShell.Header>
            <AppShell.Navbar p="md">
                <Navbar />
            </AppShell.Navbar>
            <AppShell.Main>{children}</AppShell.Main>
        </AppShell>
    );
}