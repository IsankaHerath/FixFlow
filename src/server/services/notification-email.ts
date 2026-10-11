import { db } from "@/lib/db";
import { sendMail } from "../mail";
// A lease prevents two workers from dispatching the same notification concurrently.
// SMTP cannot provide exactly-once delivery across a crash after provider acceptance.
export async function dispatchNotificationEmails() {
  const stale = new Date(Date.now()-10*60000);
  const pending = await db.notification.findMany({ where: { emailAttempts: { lt: 3 }, OR: [{emailStatus:"PENDING"},{emailStatus:"FAILED"},{emailStatus:"SENDING",emailClaimedAt:{lt:stale}}] }, include:{user:{select:{email:true,emailNotifications:true,active:true}}},take:50,orderBy:{createdAt:"asc"}});
  let accepted=0,local=0,failed=0;
  for(const item of pending){
    const claim=await db.notification.updateMany({where:{id:item.id,emailStatus:item.emailStatus,emailAttempts:item.emailAttempts},data:{emailStatus:"SENDING",emailClaimedAt:new Date(),emailAttempts:{increment:1}}});
    if(!claim.count)continue;
    if(!item.user.active || !item.user.emailNotifications){await db.notification.update({where:{id:item.id},data:{emailStatus:"SKIPPED"}});continue;}
    try {const status=await sendMail(item.user.email,item.title,`${item.message}\n\nView details: ${process.env.BETTER_AUTH_URL}${item.href}`);await db.notification.update({where:{id:item.id},data:{emailStatus:status}});if(status==="ACCEPTED")accepted++;else local++;}
    catch {await db.notification.update({where:{id:item.id},data:{emailStatus:"FAILED"}});failed++;}
  }
  return {accepted,local,failed};
}
