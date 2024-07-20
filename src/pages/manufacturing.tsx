
import type { ReactElement } from 'react'
import Layout from '../components/layout'
import type { NextPageWithLayout } from './_app'
import SupplierTable from '../components/supplier-table'
 
const Page: NextPageWithLayout = () => {
  	return <SupplierTable/>
}
 
Page.getLayout = function getLayout(page: ReactElement) {
	return (
		<Layout>
			{page}
		</Layout>
	)
}
 
export default Page