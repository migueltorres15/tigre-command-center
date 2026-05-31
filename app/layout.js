import { DM_Sans } from 'next/font/google';
import Sidebar from '@/components/Sidebar';
import InitDB from '@/components/InitDB';
import './globals.css';

const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans', weight: ['300', '400', '500', '600', '700'] });

export const metadata = {
  title: 'Tigre Command Center',
  description: 'Centro de operaciones personal',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className={dmSans.className}>
        <InitDB />
        <div className="layout">
          <Sidebar />
          <main className="main">{children}</main>
        </div>
        <a href="http://localhost:3001" target="_blank" rel="noopener noreferrer"
           style={{position:'fixed',bottom:20,right:20,background:'#7C3AED',color:'#fff',padding:'8px 14px',borderRadius:8,fontSize:12,fontWeight:600,textDecoration:'none',zIndex:100,display:'flex',alignItems:'center',gap:6,boxShadow:'0 4px 20px rgba(124,58,237,.4)'}}>
          🍶 YAO Dashboard
        </a>
      </body>
    </html>
  );
}
