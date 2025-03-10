// POST /api/attack
// Start or end an attack session

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma, { isCurrentlyBattling, getLatestSessionDetails, getActiveBossDetails } from "@/lib/prisma";
import { determineDamage, determineTreasure, determineExperience } from "@/lib/stats";

async function onBattleCompletion(search: { where: { email: string } }, userId: string, weaponMultiplier: number){
    // when an attack is triggered as complete: 
    // 1. update duration of attack session and damage done in attack session
    let latestSession = await getLatestSessionDetails(userId)
    const updateUserBattlingSession = await prisma.battle.update({
        where: {
            id: latestSession!["id"]
          },
          data: {
            duration: ((new Date()).getTime() - (new Date(latestSession!["createdAt"])).getTime())/1000, // duration of attack session in seconds
            },
        });
    console.log(updateUserBattlingSession)
    // 2. update boss hp according to battle duration
    const damageDoneLatestSession = await prisma.battle.findFirst(
        {
            where: {
                id: latestSession!["id"]
            }
        })
    console.log(determineDamage(damageDoneLatestSession!["duration"], weaponMultiplier))
    const reduceBossHP = await prisma.boss.update({
        where: {
            id: (await getActiveBossDetails())!["id"]
        },
        data: {
            health: { decrement: determineDamage(damageDoneLatestSession!["duration"], weaponMultiplier)}
        }
    })
    // 3. update user's battling status + add rewards
    const setUserIsNotBattling = await prisma.user.update({
        ...search, 
        data: {
            battling: false,
            treasure: { increment: determineTreasure(damageDoneLatestSession!["duration"], weaponMultiplier)},
            experience: { increment: determineExperience(damageDoneLatestSession!["duration"], weaponMultiplier)}
        }
    })
    // 4. update damage done in the recent session
    latestSession = await getLatestSessionDetails(userId) // refresh the info we have on hand
    const updateUserDamageSession = await prisma.battle.update({
        where: {
            id: latestSession!["id"]
          },
        data: {
            damage: determineDamage(latestSession!["duration"], weaponMultiplier)
        }
    })

}


export async function POST(request: NextRequest){
    const body = await request.json()
    const projectId = body["projectId"]
    console.log("Sdssdfsdfsdfsd", body, "AAAAAAAAAAAAAAAAA")
    const multiplier = body["multiplier"]
    console.log("WWWWWWWW", multiplier, "ASKDSKDSLDKLSKDL:SKDL:SKL:DKLSD")
    const session = await auth();

    if (!session){
        return NextResponse.json({error: "Unauthed", status: 401})
    }

    const search = {
        where: {
            email: session?.user.email!
        }
    }
    // End battling session
    if ((await isCurrentlyBattling(session?.user.email!))!["battling"]){
        onBattleCompletion(search, session?.user.id!, multiplier)
        return NextResponse.json({message: "Session - Ended - False", status: 200}) 

    } else {
        const res = await prisma.battle.create({
            data: {
                userId: session?.user.id!,
                bossId: (await getActiveBossDetails())!["id"],
                projectId: projectId
            }
        })
        const setUserIsCurrentlyBattling = await prisma.user.update({
            ...search,
            data: {
                battling: true
            }
        })
        return NextResponse.json({message: "Session - Created - True", status: "200"})
    }
}