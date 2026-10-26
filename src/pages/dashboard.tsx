
import type { ReactElement } from 'react'
import Layout from '../components/layout'
import type { NextPageWithLayout } from './_app'
import CompanyStats from '../components/company-stats';
import AreaCharts from '@/components/area-chart';
 
const Page: NextPageWithLayout = () => {
  	return (
        <>
            <CompanyStats />
            <AreaCharts />
        </>
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