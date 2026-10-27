import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'nesee — A little clarity. A better beginning.',description:'Explore whole-share stock allocations for your budget, with real machine-learning forecasts across three investment horizons.',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
