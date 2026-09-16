'use client';

import Link from 'next/link';
import {Database, Server, Menu, X} from 'lucide-react';
import {useState, useEffect, memo} from 'react';
import {cn} from '@/src/lib/utils';
import {usePathname} from 'next/navigation';
import {Button} from '@/src/components/ui/button';
import {ThemeToggle} from './ThemeToggle';

const navItems = [
    {name: 'Collections', icon: Database, href: '/'},
    {name: 'Databases', icon: Database, href: '/databases'},
    {name: 'Server Stats', icon: Server, href: '/server-stats'},
];

function SidebarComponent() {
    const [mobileOpen, setMobileOpen] = useState(false);
    const pathname = usePathname();

    useEffect(() => {
        setMobileOpen(false);
    }, [pathname]);

    return (
        <>
            {/* Mobile top bar */}
            <div className="lg:hidden fixed top-4 left-4 z-50">
                {!mobileOpen && (
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setMobileOpen(true)}
                        className="bg-white dark:bg-compass-bg shadow-md border-slate-200 dark:border-compass-border h-11 w-11 rounded-xl"
                    >
                        <Menu size={24}/>
                    </Button>
                )}
            </div>

            {/* Mobile overlay */}
            {mobileOpen && (
                <div
                    className="lg:hidden fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
                    onClick={() => setMobileOpen(false)}
                />
            )}

            {/* Sidebar */}
            <div className={cn(
                'flex flex-col h-screen bg-white dark:bg-compass-sidebar border-r border-gray-200 dark:border-compass-border transition-all duration-300 fixed lg:relative z-40 w-72',
                mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
            )}>
                <div
                    className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-compass-border h-16">
                    <Link href="/" className="flex items-center gap-3 min-w-0">
                        <img src="/favicon-96x96.png" alt="MongoGUI" className="h-9 w-9 rounded-xl shadow-sm"/>
                        <span
                            className="font-bold text-xl text-blue-700 dark:text-compass-green truncate">MongoGUI</span>
                    </Link>
                    <div className="flex items-center gap-1">
                        <ThemeToggle/>
                        <button
                            onClick={() => setMobileOpen(false)}
                            className="lg:hidden p-1.5 hover:bg-gray-200 dark:hover:bg-compass-border/30 rounded-lg text-gray-500"
                        >
                            <X size={22}/>
                        </button>
                    </div>
                </div>

                <nav className="flex-1 overflow-y-auto py-6">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={cn(
                                    'flex items-center px-6 py-4 lg:py-3.5 text-gray-600 dark:text-compass-muted hover:bg-gray-100 dark:hover:bg-compass-border/30 hover:text-blue-700 dark:hover:text-compass-text transition-all group relative',
                                    isActive && 'bg-blue-50 dark:bg-compass-border/50 text-blue-700 dark:text-compass-green'
                                )}
                            >
                                {isActive && <div
                                    className="absolute left-0 top-0 bottom-0 w-1 bg-blue-700 dark:bg-compass-green rounded-r-full"/>}
                                <item.icon size={22}
                                           className="min-w-[22px] group-hover:scale-110 transition-transform"/>
                                <span className="ml-4 font-medium whitespace-nowrap">{item.name}</span>
                            </Link>
                        );
                    })}
                </nav>
            </div>
        </>
    );
}

export default memo(SidebarComponent);
