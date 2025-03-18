'use client'
import { useState } from "react";
import Modal from "./Modal";
import useSound from "use-sound";
import Link from "next/link";
import { useSession } from "next-auth/react";
import Log from "../Log";

const Music = ({audio, play, stop, setAudio}: {audio: boolean, play: () => void, stop: () => void, setAudio: (value: any) => void}) => {
    return (
        <>
            <button onClick={() => audio ? (stop(), setAudio(false)) : (play(), setAudio(true))}>
                { audio
                ? <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
                  </svg>
                : <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75 19.5 12m0 0 2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6 4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
                  </svg>
              }
            </button>
            </>
    )

}

export function Info(){
    const [ infoIsOpen, setInfoIsOpen ] = useState(false)
    const [ logIsOpen, setLogIsOpen ] = useState(false)
    const [ audio, setAudio ] = useState(false);
    const [ play, { stop }] = useSound("/audio.mp3", { volume: audio ? 1 : 0, loop: true})
    const session = useSession();

    return (
        <>
        <div className = "absolute right-10 top-10 flex flex-col gap-1 sm:gap-5">
            <button onClick={() => setInfoIsOpen(true)}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                </svg>
            </button>

            { session.status === "authenticated" ? 
                <button onClick={() => setLogIsOpen(true)}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><path d="M0 80l0 48c0 17.7 14.3 32 32 32l16 0 48 0 0-80c0-26.5-21.5-48-48-48S0 53.5 0 80zM112 32c10 13.4 16 30 16 48l0 304c0 35.3 28.7 64 64 64s64-28.7 64-64l0-5.3c0-32.4 26.3-58.7 58.7-58.7L480 320l0-192c0-53-43-96-96-96L112 32zM464 480c61.9 0 112-50.1 112-112c0-8.8-7.2-16-16-16l-245.3 0c-14.7 0-26.7 11.9-26.7 26.7l0 5.3c0 53-43 96-96 96l176 0 96 0z"/></svg>
                </button>
            : null }

            <Music audio={audio} setAudio={setAudio} play={play} stop={stop}/>
        </div>

        <Modal isOpen={infoIsOpen} setIsOpen={setInfoIsOpen}>
            <h1 className = "text-3xl md:text-5xl py-4">Settings</h1>
                <div className = "flex flex-col gap-4 h-full">
                    <p className = "flex flex-row items-center gap-2"><span className = "text-accent">Music: </span> <Link className = "link" target="_blank" href= "https://www.youtube.com/watch?v=HFgHkynhBnk">Prodigy Game OST</Link> <Music audio={audio} setAudio={setAudio} play={play} stop={stop}/></p>
                    <p><span className = "text-accent">Repository: </span> <Link className = "link" target="_blank" href = "https://github.com/hackclub/rpg">https://github.com/hackclub/rpg</Link></p>
                    <p>A project by <span className = "text-accent"><Link className = "link" target="_blank" href = "https://github.com/phthallo">@phthallo</Link>.</span></p>
                </div>
        </Modal>
        { session.status === "authenticated" ?
        <Log logIsOpen={logIsOpen} setLogIsOpen={setLogIsOpen}/>
        : null }

        </>
    )
}