import { timingSafeEqual } from "node:crypto";
import { dispatchNotificationEmails } from "@/server/services/notification-email";
import { errorResponse } from "@/server/errors";
export async function POST(req:Request){
  const actual=Buffer.from(req.headers.get("authorization")??"");const expected=Buffer.from(`Bearer ${process.env.CRON_SECRET??""}`);
  if(!process.env.CRON_SECRET || actual.length!==expected.length || !timingSafeEqual(actual,expected))return Response.json({error:"Unauthorized"},{status:401});
  try{return Response.json({data:await dispatchNotificationEmails()});}catch(e){return errorResponse(e);}
}
