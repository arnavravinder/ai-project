import NextAuth, { NextAuthConfig } from "next-auth"
import SlackProvider from "next-auth/providers/slack"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import prisma, { setUserDefaultInventory } from "@/lib/prisma"

export const config: NextAuthConfig = {
  theme: {
    logo: "",
  },
  debug: true,
  adapter: PrismaAdapter(prisma),
  providers: [
    SlackProvider({
      clientId: process.env.SLACK_CLIENT_ID!,
      clientSecret: process.env.SLACK_CLIENT_SECRET!,
      checks: ['pkce', 'nonce'],
    }),
  ],
  events: {
    async signIn({user, account, profile, isNewUser}) {
      if (isNewUser){
        setUserDefaultInventory(user.id!)
        // manually assign slack id because no jwt
         await prisma.user.update({
           where: {
             id: user.id!
           },
           data: {
             providerAccountId: profile?.sub!,
           }
         })
      }
    }
  },
  callbacks: {
    async session({session, token, user, trigger}) {  
      return { ...session, providerAccountId: user.providerAccountId }
    },
  },
}

export const { handlers, auth, signIn, signOut } = NextAuth(config)