import {
    TextInput,
    PasswordInput,
    Checkbox,
    Anchor,
    Paper,
    Title,
    Text,
    Container,
    Group,
    Button,
    Transition, 
    Flex
} from '@mantine/core';
import classes from '@/styles/login.module.css';;
import { useMounted } from '@mantine/hooks';
import { useState } from 'react';
import { ColorSchemeToggle } from '../colorSchemeToggle';
import { useRouter } from 'next/router';
  
export function Login() {
    const mounted = useMounted();
    const router = useRouter()

    return (
        <>
            <Transition
                mounted={mounted}
                transition="pop"
                duration={400}
                timingFunction="ease"
                enterDelay={500}
            >
            {(styles) =>
                <Container size={420} py={40} style={styles}>
                    <Title ta="center" className={classes.title}>
                        Kusina Filipino
                    </Title>

                    <Paper withBorder shadow="md" p={30} mt={30} radius="md">
                        <TextInput label="User" placeholder="Username" required />
                        <PasswordInput label="Password" placeholder="Password" required mt="md" />
                        <Group justify="space-between" mt="lg">
                            <Checkbox label="Remember me" />
                            <Anchor component="button" size="sm">
                                Forgot password?
                            </Anchor>
                        </Group>
                        <Button fullWidth mt="xl" onClick={() => router.push('/dashboard')}>
                            LOGIN
                        </Button>
                    </Paper>
                </Container>
            }
            </Transition>
        </>
    );
}