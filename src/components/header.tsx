import { Link, useNavigate } from '@tanstack/react-router';
import { Image } from '@unpic/react';
import {
	ChevronDown,
	Leaf,
	LogIn,
	LogOut,
	MonitorCog,
	Moon,
	Paintbrush,
	Palette,
	Rose,
	Settings,
	Sun,
	SunMoon,
	User,
} from 'lucide-react';
import { authenticationClient } from '~/lib/authentication/client';
import { useAppearance } from './appearance-provider';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuPortal,
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

function AppearanceDropdown() {
	const { setPalette, setTheme } = useAppearance();

	return (
		<DropdownMenuSub>
			<DropdownMenuSubTrigger>
				<Palette />
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
								<DropdownMenuItem onClick={() => setTheme('dark')}>
									<Moon />
									Dark
								</DropdownMenuItem>
								<DropdownMenuItem onClick={() => setTheme('light')}>
									<Sun />
									Light
								</DropdownMenuItem>
								<DropdownMenuItem onClick={() => setTheme('system')}>
									<MonitorCog /> System
								</DropdownMenuItem>
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
								<DropdownMenuItem onClick={() => setPalette('default')}>
									<Rose />
									Default
								</DropdownMenuItem>
								<DropdownMenuItem onClick={() => setPalette('greenery')}>
									<Leaf />
									Greenery
								</DropdownMenuItem>
							</DropdownMenuSubContent>
						</DropdownMenuPortal>
					</DropdownMenuSub>
				</DropdownMenuSubContent>
			</DropdownMenuPortal>
		</DropdownMenuSub>
	);
}

export default function Header({ session }: { session: typeof authenticationClient.$Infer.Session | null }) {
	const navigate = useNavigate();

	return (
		<header className="flex items-center justify-around border-b py-2">
			<div className="flex flex-row items-center gap-2">
				<Image src="/insight.png" width={32} height={32} alt="Insight logo" />
				Insight
			</div>
			<NavigationMenu>
				<NavigationMenuList>
					<NavigationMenuItem>
						<NavigationMenuLink className={navigationMenuTriggerStyle()} asChild>
							<Link to="/inbox">Inbox</Link>
						</NavigationMenuLink>
					</NavigationMenuItem>
				</NavigationMenuList>
			</NavigationMenu>
			{session?.user ? (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost">
							<Avatar>
								<AvatarImage src={session.user.id} />
								<AvatarFallback>{session.user.name.charAt(0)}</AvatarFallback>
							</Avatar>
							{session.user.name}
							<ChevronDown />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent>
						<DropdownMenuGroup>
							<DropdownMenuLabel>My Account</DropdownMenuLabel>
							<DropdownMenuItem asChild>
								<Link to="/account/settings">
									<Settings />
									Settings
								</Link>
							</DropdownMenuItem>
							<AppearanceDropdown />
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							variant="destructive"
							onClick={() => authenticationClient.signOut({ fetchOptions: { onSuccess: () => navigate({ to: '/' }) } })}
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
							<Link to="/auth/sign-in">
								<LogIn />
								Sign In
							</Link>
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			)}
		</header>
	);
}
