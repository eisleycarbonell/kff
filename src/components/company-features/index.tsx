import {
	Badge,
	Group,
	Title,
	Text,
	Card,
	SimpleGrid,
	Container,
	rem,
	useMantineTheme,
} from '@mantine/core';
import { IconGauge, IconUser, IconCookie } from '@tabler/icons-react';
import classes from '@/styles/about.module.css';;
  
const mockdata = [
	{
		title: 'Best ingredients',
		description:
			'We at Kusina Filipino Food believe that one of the best things about living in the Philippines is eating good food.',
		icon: IconCookie,
	},
	{
		title: 'Fresh focused',
		description:
			'We are here to provide good quality food products.',
		icon: IconGauge,
	},
	{
		title: 'Customers needs',
		description:
			'Enhance your experience with our range of delicious condiments, spices, noodles, herbs, preserve, baking essential, dried fruits and more.',
		icon: IconUser,
	},
];
  
export default function FeaturesCards() {
	const theme = useMantineTheme();
	const features = mockdata.map((feature) => (
		<Card key={feature.title} shadow="md" radius="md" className={classes.card} padding="xl">
			<feature.icon
				style={{ width: rem(50), height: rem(50) }}
				stroke={2}
				color={theme.colors.blue[6]}
			/>
			<Text fz="lg" fw={500} className={classes.cardTitle} mt="md">
				{feature.title}
			</Text>
			<Text fz="sm" c="dimmed" mt="sm">
				{feature.description}
			</Text>
		</Card>
	));
  
	return features
}