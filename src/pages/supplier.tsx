
import type { ReactElement } from 'react'
import Layout from '../components/layout'
import type { NextPageWithLayout } from './_app'
import SupplierTbl from '../components/supplier/table'
import { useMantineColorScheme } from '@mantine/core'
 
const Page: NextPageWithLayout = () => {
    const globalTheme = useMantineColorScheme();

  	return <SupplierTbl feed={{theme: globalTheme}} />
}
 
Page.getLayout = function getLayout(page: ReactElement) {
	return (
		<Layout>
			{page}
		</Layout>
	)
}
 
export default Page