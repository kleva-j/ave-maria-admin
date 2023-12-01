/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { EmailTemplate } from "@/components/emails/FirstEmail";
import { emailSchema } from "@/lib/email/utils";
import { NextResponse } from "next/server";
import { resend } from "@/lib/email/index";

export async function POST(request: Request) {
  const body = await request.json();
  const { name, email } = emailSchema.parse(body);
  try {
    const data = await resend.emails.send({
      from: "Kirimase <onboarding@resend.dev>",
      to: [email],
      subject: "Hello world!",
      react: EmailTemplate({ firstName: name }),
      text: "Email powered by Resend.",
    });

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error });
  }
}
