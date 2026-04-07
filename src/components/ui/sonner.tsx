import { CircleCheckIcon, InfoIcon, OctagonXIcon, TriangleAlertIcon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Toaster as Sonner, type ToasterProps } from 'sonner';
import { Spinner } from './spinner';

const Toaster = ({ ...props }: ToasterProps) => {
	const { theme = 'system' } = useTheme();

	return (
		<Sonner
			theme={theme as ToasterProps['theme']}
			className="toaster group"
			icons={{
				success: <CircleCheckIcon className="size-4" />,
				info: <InfoIcon className="size-4" />,
				warning: <TriangleAlertIcon className="size-4" />,
				error: <OctagonXIcon className="size-4" />,
				loading: <Spinner />,
			}}
			style={
				{
					'--normal-bg': 'var(--popover)',
					'--normal-text': 'var(--popover-foreground)',
					'--normal-border': 'var(--border)',
					'--border-radius': 'var(--radius)',
				} as React.CSSProperties
			}
			toastOptions={{
				classNames: {
					toast: 'cn-toast',
				},
			}}
			{...props}
		/>
	);
};

// https://github.com/shadcn-ui/ui/issues/3461#issuecomment-2726898186
// https://sonner.emilkowal.ski/other#shadow-dom-support
// Prevent dismissing the dialog when clicking on a toast.
const handleInteractOutside = (event: Event) => {
	if (event.target instanceof Element && event.target.closest('[data-sonner-toaster]')) {
		event.preventDefault();
	}
};

export { handleInteractOutside, Toaster };
