// import '@mantine/core/styles.css';
// import Layout from '../components/layout'
// import type { AppProps } from 'next/app';
// import { createTheme, MantineProvider } from '@mantine/core';

// const theme = createTheme({
//   /** Put your mantine theme override here */
// });

// export default function App({ Component, pageProps }: AppProps) {
//   return (
//     <MantineProvider theme={theme}>
// 		<Layout>
// 			<Component {...pageProps} />
// 		</Layout>
//     </MantineProvider>
//   );
// }

import '@mantine/core/styles.css';
import '@mantine/charts/styles.css';
import '@mantine/notifications/styles.css';
import type { ReactElement, ReactNode } from 'react'
import type { NextPage } from 'next'
import type { AppProps } from 'next/app'
import { createTheme, MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
 
export type NextPageWithLayout<P = {}, IP = P> = NextPage<P, IP> & {
  	getLayout?: (page: ReactElement) => ReactNode
}
 
type AppPropsWithLayout = AppProps & {
  	Component: NextPageWithLayout
}

const theme = createTheme({
  	/** Put your mantine theme override here */
});
 
export default function MyApp({ Component, pageProps }: AppPropsWithLayout) {
  	// Use the layout defined at the page level, if available
	const getLayout = Component.getLayout ?? ((page) => page)

	return (
		<MantineProvider theme={theme}>
			<Notifications />
			{getLayout(<Component {...pageProps} />)}
		</MantineProvider>
	)
}