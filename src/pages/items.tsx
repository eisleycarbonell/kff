
import type { ReactElement } from 'react'
import Layout from '../components/layout'
import type { NextPageWithLayout } from './_app'
import Table from '../components/item/table'
import { useMantineColorScheme } from '@mantine/core'
 
const Page: NextPageWithLayout = () => {
    const globalTheme = useMantineColorScheme();

  	return <Table feed={{theme: globalTheme}} />
}
 
Page.getLayout = function getLayout(page: ReactElement) {
	return (
		<Layout>
			{page}
		</Layout>
	)
}
 
export default Page