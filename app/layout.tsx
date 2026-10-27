import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import './typography.css';
const jakarta=localFont({src:'./fonts/PlusJakartaSans-variable.ttf',variable:'--font-nesee',weight:'200 800',display:'swap',preload:true});
export const metadata:Metadata={title:'nesee — A little clarity. A better beginning.',description:'Explore whole-share stock allocations for your budget, with real machine-learning forecasts across three investment horizons.',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en" className={jakarta.variable}><body>{children}</body></html>}
