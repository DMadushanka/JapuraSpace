import React from 'react';
import Header from './Header'; // We'll create this in the same folder
import { Outlet } from 'react-router-dom';

const Layout = () => {
    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <Header />
            <main style={{ flex: 1, padding: '20px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
                <Outlet />
            </main>
            <footer style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                &copy; {new Date().getFullYear()} University of Sri Jayewardenepura
            </footer>
        </div>
    );
};

export default Layout;
