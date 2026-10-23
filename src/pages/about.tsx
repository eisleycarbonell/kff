
import type { ReactElement } from 'react'
import Layout from '../components/layout'
import type { NextPageWithLayout } from './_app'
import CompanyFeatures from '../components/company-features';
import { Badge, Container, Group, SimpleGrid, Title, Text } from '@mantine/core';
import classes from '@/styles/about.module.css';
 
const Page: NextPageWithLayout = () => {
  	return (
		<Container size="lg" py="xl">
			<Group justify="center">
				<Badge variant="filled" size="lg">
					Best company ever
				</Badge>
			</Group>
	
			<Title order={2} className={classes.title} ta="center" mt="sm">
				Producing high quality food products and spices.
			</Title>
	
			<Text c="dimmed" className={classes.description} ta="center" mt="md">
				Our team of experts makes sure our products are always fresh, made from the best ingredients and produced according to our customers’ needs.
			</Text>
	
			<SimpleGrid cols={{ base: 1, md: 3 }} spacing="xl" mt={50}>
				<CompanyFeatures />
			</SimpleGrid>
		</Container>
	)
}
 
Page.getLayout = function getLayout(page: ReactElement) {
	return (
		<Layout>
			{page}
		</Layout>
	)
}
 
export default Page