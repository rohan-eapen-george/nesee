import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Nivesh — A little clarity. A better beginning.',description:'Explore affordable Indian stocks and real machine-learning forecasts with clear risks and transparent validation.',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
