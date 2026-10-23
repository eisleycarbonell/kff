import styles from "@/styles/Home.module.css";
import { Login } from '../components/login';
import { NextPage } from "next";
import classes from '@/styles/login.module.css';import { Flex } from "@mantine/core";
import { ColorSchemeToggle } from "@/components/colorSchemeToggle";

const Page: NextPage = () => {
	return (
		<>
			<div className={classes.background}></div>
			<Flex
                justify="flex-end"
                align="center"
                direction="row"
                wrap="wrap"
            >
                <ColorSchemeToggle />
            </Flex>
			<Login />
		</>
	)
}

export default Page