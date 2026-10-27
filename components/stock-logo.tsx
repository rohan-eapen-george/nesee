'use client';
import {useState} from 'react';
import Image from 'next/image';
import matchedLogos from '../data/stock-logos.json';
const logos:Record<string,string>=matchedLogos;

/** Decorative company badge: locally matched asset with an initials fallback. */
export default function StockLogo({symbol,name,className='',priority=false}:{symbol:string;name?:string;className?:string;priority?:boolean}){
  const [failedSource,setFailedSource]=useState<string|null>(null);
  const source=logos[symbol];
  const showImage=!!source&&failedSource!==source;
  return <span className={`company-logo ${className}${showImage?' stock-logo':''}`} title={name||symbol} aria-hidden="true">
    {showImage?<Image src={source} alt="" width={32} height={32} unoptimized loading={priority?'eager':'lazy'} className="stock-logo-image" draggable={false} onError={()=>setFailedSource(source)}/>:symbol.slice(0,2)}
  </span>;
}
