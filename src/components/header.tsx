import { getRouteApi, useRouter } from '@tanstack/react-router';
import { Image } from '@unpic/react';
import {
	ChevronDown,
	Citrus,
	CloudSun,
	House,
	Leaf,
	LogIn,
	LogOut,
	MonitorCog,
	Moon,
	Paintbrush,
	Palette as PaletteIcon,
	Rose,
	Settings,
	Sun,
	SunMoon,
	User,
} from 'lucide-react';
import type { Palette, Theme } from '~/lib/appearance';
import authClient from '~/lib/authentication/client';
import { useAppearance } from './appearance-provider';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Button } from './ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuPortal,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
	NavigationMenu,
	NavigationMenuItem,
	NavigationMenuLink,
	NavigationMenuList,
	navigationMenuTriggerStyle,
} from './ui/navigation-menu';

const Route = getRouteApi('__root__');

function AppearanceDropdown() {
	const { palette, setPalette, setTheme, theme } = useAppearance();

	return (
		<DropdownMenuSub>
			<DropdownMenuSubTrigger>
				<PaletteIcon />
				Appearance
			</DropdownMenuSubTrigger>
			<DropdownMenuPortal>
				<DropdownMenuSubContent>
					<DropdownMenuSub>
						<DropdownMenuSubTrigger>
							<SunMoon />
							Theme
						</DropdownMenuSubTrigger>
						<DropdownMenuPortal>
							<DropdownMenuSubContent>
								<DropdownMenuRadioGroup value={theme} onValueChange={(value) => setTheme(value as Theme)}>
									<DropdownMenuRadioItem value={'dark' satisfies Theme}>
										<Moon />
										Dark
									</DropdownMenuRadioItem>
									<DropdownMenuRadioItem value={'light' satisfies Theme}>
										<Sun />
										Light
									</DropdownMenuRadioItem>
									<DropdownMenuRadioItem value={'system' satisfies Theme}>
										<MonitorCog /> System
									</DropdownMenuRadioItem>
								</DropdownMenuRadioGroup>
							</DropdownMenuSubContent>
						</DropdownMenuPortal>
					</DropdownMenuSub>
					<DropdownMenuSub>
						<DropdownMenuSubTrigger>
							<Paintbrush />
							Palette
						</DropdownMenuSubTrigger>
						<DropdownMenuPortal>
							<DropdownMenuSubContent>
								<DropdownMenuRadioGroup value={palette} onValueChange={(value) => setPalette(value as Palette)}>
									<DropdownMenuRadioItem value={'default' satisfies Palette}>
										<House />
										Default
									</DropdownMenuRadioItem>
									<DropdownMenuRadioItem value={'rose' satisfies Palette}>
										<Rose />
										Rose
									</DropdownMenuRadioItem>
									<DropdownMenuRadioItem value={'orange' satisfies Palette}>
										<Citrus />
										Orange
									</DropdownMenuRadioItem>
									<DropdownMenuRadioItem value={'green' satisfies Palette}>
										<Leaf />
										Green
									</DropdownMenuRadioItem>
									<DropdownMenuRadioItem value={'sky' satisfies Palette}>
										<CloudSun />
										Sky
									</DropdownMenuRadioItem>
								</DropdownMenuRadioGroup>
							</DropdownMenuSubContent>
						</DropdownMenuPortal>
					</DropdownMenuSub>
				</DropdownMenuSubContent>
			</DropdownMenuPortal>
		</DropdownMenuSub>
	);
}

export default function Header() {
	const { user } = Route.useRouteContext();
	const router = useRouter();
	const navigate = Route.useNavigate();

	return (
		<header className="flex h-(--header-height) shrink-0 items-center justify-around border-b py-2">
			<Route.Link to="/" className="flex flex-row items-center gap-2">
				<Image src="/insight.png" width={32} height={32} alt="Insight logo" />
				Insight
			</Route.Link>
			<NavigationMenu>
				<NavigationMenuList>
					<NavigationMenuItem>
						<NavigationMenuLink className={navigationMenuTriggerStyle()} asChild>
							<Route.Link to="/inbox">Inbox</Route.Link>
						</NavigationMenuLink>
					</NavigationMenuItem>
				</NavigationMenuList>
			</NavigationMenu>
			{user ? (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost">
							<Avatar>
								<AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
							</Avatar>
							{user.name}
							<ChevronDown />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent>
						<DropdownMenuGroup>
							<DropdownMenuLabel>My Account</DropdownMenuLabel>
							<DropdownMenuItem asChild>
								<Route.Link to="/account/settings">
									<Settings />
									Settings
								</Route.Link>
							</DropdownMenuItem>
							<AppearanceDropdown />
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							variant="destructive"
							onClick={async () => {
								await authClient.signOut();

								router.invalidate({ filter: (match) => match.routeId === '__root__' });
								navigate({ to: '/' });
							}}
						>
							<LogOut />
							Log Out
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			) : (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost">
							<Avatar>
								<AvatarFallback>
									<User className="text-destructive" />
								</AvatarFallback>
							</Avatar>
							<p className="text-destructive">Signed Out</p>
							<ChevronDown />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent>
						<DropdownMenuGroup>
							<AppearanceDropdown />
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
						<DropdownMenuItem asChild>
							<Route.Link to="/auth/sign-in">
								<LogIn />
								Sign In
							</Route.Link>
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			)}
		</header>
	);
}
