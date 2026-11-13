"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { cloud } from "../../lib/cloud";

const bucket = "myrtle-2026-media";
const maxSize = 50 * 1024 * 1024;
const types: Record<string,string> = {jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",webp:"image/webp",gif:"image/gif",mp4:"video/mp4",mov:"video/quicktime",webm:"video/webm"};
type Media = { name: string; url: string; video: boolean; own: boolean };
export default function CommunityMedia() {
  const [items,setItems] = useState<Media[]>([]), [busy,setBusy] = useState(false), [status,setStatus] = useState(""), [error,setError] = useState(""), [loading,setLoading] = useState(true);
  const input = useRef<HTMLInputElement>(null);
  const load = useCallback(async () => {
    if(!cloud) { setError("Sign in to view group uploads."); setLoading(false); return; }
    try {
      const {data:{session}} = await cloud.auth.getSession();
      if(!session) throw Error("Please sign in again to view group uploads.");
      const files: {name:string; metadata?:{mimetype?:string}|null}[] = [];
      for(let offset=0;;offset+=100) {
        const {data,error} = await cloud.storage.from(bucket).list("",{limit:100,offset,sortBy:{column:"created_at",order:"desc"}});
        if(error) throw error;
        files.push(...(data??[]));
        if(!data || data.length<100) break;
      }
      if(!files.length) { setItems([]); return; }
      const {data,error} = await cloud.storage.from(bucket).createSignedUrls(files.map(f=>f.name),3600);
      if(error) throw error;
      setItems(files.flatMap((f,i)=> data?.[i]?.signedUrl ? [{name:f.name,url:data[i].signedUrl,video:f.metadata?.mimetype?.startsWith("video/")??/\.(mp4|mov|webm)$/i.test(f.name),own:f.name.startsWith(session.user.id+"--")}] : []));
    } catch(e) { setError(e instanceof Error ? e.message : "Couldn't load group uploads. Tap Refresh to retry."); }
    finally { setLoading(false); }
  },[]);
  useEffect(()=>{void load(); const timer=setInterval(()=>void load(),10*60*1000);return ()=>clearInterval(timer);},[load]);
  async function upload(files: File[]) {
    if(!cloud || busy || !files.length) return;
    setBusy(true);setError("");let added=0;const failures:string[]=[];
    try {
      for(let i=0;i<files.length;i++) {
        const file=files[i];
        try {
          const extension=file.name.split(".").pop()?.toLowerCase()??"";
          const mime=types[extension];
          if(!mime) throw Error("Use JPG, PNG, WebP, GIF, MP4, MOV or WebM.");
          if(file.size===0 || file.size>maxSize) throw Error("Each file must be between 1 byte and 50 MB.");
          const {data:{session}}=await cloud.auth.getSession();
          if(!session) throw Error("Please sign in again before uploading.");
          const name=`${session.user.id}--${crypto.randomUUID()}.${extension}`;
          setStatus(`Uploading ${i+1} of ${files.length}: ${file.name}`);
          if(file.size>6*1024*1024) {
            const {Upload}=await import("tus-js-client");
            await new Promise<void>((resolve,reject)=>{
              const task=new Upload(file,{
                endpoint:process.env.NEXT_PUBLIC_SUPABASE_URL+"/storage/v1/upload/resumable",
                headers:{authorization:`Bearer ${session.access_token}`,apikey:process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY??""},
                retryDelays:[0,3000,5000,10000],chunkSize:6*1024*1024,uploadDataDuringCreation:true,removeFingerprintOnSuccess:true,
                metadata:{bucketName:bucket,objectName:name,contentType:mime,cacheControl:"3600"},
                onProgress:(sent,total)=>setStatus(`Uploading ${i+1} of ${files.length}: ${Math.round(sent/total*100)}% — ${file.name}`),
                onSuccess:()=>resolve(),onError:reject,
              });task.start();
            });
          } else {
            const {error}=await cloud.storage.from(bucket).upload(name,file,{contentType:mime,upsert:false});
            if(error) throw error;
          }
          added++;
        } catch(e) { failures.push(`${file.name}: ${e instanceof Error?e.message:"Upload failed. Please retry."}`); }
      }
      setStatus(`${added} ${added===1?"file":"files"} added to the album.`);
      setError(failures.join("\n")); await load();
    } finally {setBusy(false);if(input.current)input.current.value="";}
  }
  async function remove(item:Media) {
    if(!cloud || busy || !window.confirm("Delete your upload from the group album?"))return;
    setBusy(true);setError("");
    try {const {error}=await cloud.storage.from(bucket).remove([item.name]);if(error)throw error;setStatus("Upload deleted.");await load();}
    catch(e){setError(e instanceof Error?e.message:"Couldn't delete this upload.");}finally{setBusy(false);}
  }
  return <section className="community-media panel" aria-busy={busy}>
    <span className="season-kicker">SHARED BY THE GROUP</span><h2>More memories welcome.</h2><p>Add your photos and videos from the 2026 trip. Everyone signed into the group can view them.</p>
    <div className="season-actions"><button className="primary" disabled={busy} onClick={()=>input.current?.click()}>{busy?"Uploading…":"＋ Add photos or videos"}</button><button disabled={busy} onClick={()=>{setError("");void load();}}>Refresh</button></div>
    <input ref={input} type="file" hidden multiple accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm,.mov" onChange={e=>void upload(Array.from(e.target.files??[]))}/>
    <p className="media-hint">Select multiple files · Up to 50 MB each · Keep this page open while uploading</p>
    <p role="status" aria-live="polite">{status || (loading?"Loading group uploads…":`${items.length} group uploads`)}</p>
    {error && <p role="alert" className="media-error">{error}</p>}
    <div className="trip-photo-grid">{items.map(item=><article className="community-media-card" key={item.name}>
      {item.video?<video controls playsInline preload="metadata" src={item.url} aria-label="Group trip video"/>:<a href={item.url} target="_blank" rel="noreferrer" aria-label="Open full group photo"><img src={item.url} alt="Photo shared from the 2026 Myrtle Beach trip" loading="lazy"/></a>}
      <div className="media-card-actions"><a href={item.url} target="_blank" rel="noreferrer">Open {item.video?"video":"photo"} ↗</a>{item.own && <button disabled={busy} onClick={()=>void remove(item)}>Delete mine</button>}</div>
    </article>)}</div>
  </section>;
}
