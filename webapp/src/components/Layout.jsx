import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { auth, settingsApi } from '../api'
import { useEffect, useState } from 'react'
import {
    LayoutDashboard,
    Link2,
    Bot,
    MessageSquare,
    ShieldX,
    Settings,
    Menu,
    LogOut,
    User,
    ChevronLeft,
    ChevronRight,
    Wifi,
    WifiOff,
    Users,
    BarChart3,
    MessageCircle
} from 'lucide-react'

export default function Layout() {
    const [user, setUser] = useState(null)
    const [settings, setSettings] = useState(null)
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
    const navigate = useNavigate()

    useEffect(() => {
        auth.me()
            .then((d) => setUser(d.user))
            .catch(() => navigate('/login'))
        settingsApi.get().then(setSettings).catch(() => setSettings({}))
    }, [navigate])

    const handleLogout = () => {
        auth.logout().then(() => navigate('/login'))
    }

    const darkClass = settings?.darkMode ? ' dark' : ''
    useEffect(() => {
        if (settings?.branding?.accentColor) {
            document.documentElement.style.setProperty('--accent', settings.branding.accentColor)
        }
    }, [settings?.branding?.accentColor])

    if (!user) return null

    const navItems = [
        { to: '/', icon: LayoutDashboard, label: 'Resumen' },
        { to: '/conexion', icon: Link2, label: 'Conexión' },
        { to: '/agentes', icon: Bot, label: 'Configurar Agente' },
        { to: '/monitor', icon: MessageSquare, label: 'Monitor de Chats' },
        { to: '/numeros-bloqueados', icon: ShieldX, label: 'Números Bloqueados' },
        { to: '/configuraciones', icon: Settings, label: 'Configuraciones' },
    ]

    return (
        <div className={'app-layout' + darkClass}>
            {/* Overlay para móvil */}
            <div
                className={`sidebar-overlay ${sidebarOpen ? 'show' : ''}`}
                onClick={() => setSidebarOpen(false)}
            />

            {/* Sidebar */}
            <aside className={`sidebar ${sidebarOpen ? 'open' : ''} ${sidebarCollapsed ? 'collapsed' : ''}`}>
                {/* Logo */}
                <div className="sidebar-logo">
                    <div className="flex items-center gap-2">
                        <Bot className="w-8 h-8" style={{ color: 'var(--accent)' }} />
                        <div className={!sidebarCollapsed ? 'block' : 'hidden'}>
                            <div className="font-bold text-lg">Controla</div>
                            <small className="text-xs opacity-70">AGENTES IA</small>
                        </div>
                    </div>
                    <button
                        className="p-1 hover:bg-bg-tertiary rounded text-text-secondary hover:text-text-primary"
                        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                        title={sidebarCollapsed ? 'Expandir' : 'Colapsar'}
                    >
                        {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                    </button>
                </div>

                {/* Navegación (scroleable) */}
                <nav className="sidebar-nav">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.to === '/'}
                            className={({ isActive }) => (isActive ? 'active' : '')}
                            onClick={() => setSidebarOpen(false)}
                        >
                            <item.icon size={20} />
                            {!sidebarCollapsed && <span>{item.label}</span>}
                        </NavLink>
                    ))}
                </nav>

                {/* Usuario (siempre visible) */}
                <div className="sidebar-user">
                    <div className="flex items-center gap-2">
                        <div className="avatar placeholder">
                            <div className="bg-bg-tertiary text-text-primary rounded-full w-10 overflow-hidden flex items-center justify-center">
                                {settings?.branding?.logoUrl ? (
                                    <img src={settings.branding.logoUrl} alt={user.name} className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-xs">{user.name?.charAt(0) || 'U'}</span>
                                )}
                            </div>
                        </div>
                        {!sidebarCollapsed && (
                            <div className="flex-1 min-w-0">
                                <div className="font-medium truncate text-text-primary">{user.name}</div>
                                <div className="text-xs opacity-70 truncate text-text-secondary">{user.email}</div>
                            </div>
                        )}
                    </div>
                    {!sidebarCollapsed && (
                        <button
                            className="btn btn-ghost text-error mt-2 w-full justify-start"
                            onClick={handleLogout}
                        >
                            <LogOut size={16} />
                            <span>Cerrar Sesión</span>
                        </button>
                    )}
                </div>
            </aside>

            {/* Main Content */}
            <main className="main">
                {/* Header */}
                <header className="header">
                    <div className="flex items-center gap-3">
                        <button
                            className="hamburger-btn"
                            onClick={() => setSidebarOpen(true)}
                        >
                            <Menu size={24} />
                        </button>
                        <div>
                            <h1 className="text-xl font-bold text-text-primary">Workspace de Agentes</h1>
                            <div className="text-sm text-text-secondary">Gestiona tus instancias de WhatsApp y Bots</div>
                        </div>
                    </div>
                    <div className="header-right flex items-center gap-3">
                        <div className="dropdown dropdown-end lg:hidden">
                            <div tabIndex={0} role="button" className="btn btn-ghost btn-circle">
                                <User size={20} className="text-text-secondary" />
                            </div>
                            <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-bg-secondary rounded-box w-52 border border-border-color">
                                <li className="px-4 py-2 border-b border-border-color">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="avatar placeholder w-10">
                                            <div className="bg-bg-tertiary text-text-primary rounded-full w-10 overflow-hidden flex items-center justify-center">
                                                {settings?.branding?.logoUrl ? (
                                                    <img src={settings.branding.logoUrl} alt={user.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <User size={20} />
                                                )}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="font-medium text-text-primary">{user.name}</div>
                                            <div className="text-xs text-text-secondary">{user.email}</div>
                                        </div>
                                    </div>
                                </li>
                                <li>
                                    <a onClick={handleLogout} className="text-error">
                                        <LogOut size={16} />
                                        Cerrar Sesión
                                    </a>
                                </li>
                            </ul>
                        </div>
                    </div>
                </header>

                {/* Content */}
                <div className="content">
                    <Outlet />
                </div>
            </main>
        </div>
    )
}
