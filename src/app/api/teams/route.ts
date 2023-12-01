import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  createTeam,
  deleteTeam,
  updateTeam,
} from "@/lib/api/teams/mutations";
import { 
  teamIdSchema,
  insertTeamParams,
  updateTeamParams 
} from "@/server/db/schema/teams";

export async function POST(req: Request) {
  try {
    const validatedData = insertTeamParams.parse(await req.json());
    const { team, error } = await createTeam(validatedData);
    if (error) return NextResponse.json({ error }, { status: 500 });
    revalidatePath("/teams"); // optional - assumes you will have named route same as entity
    return NextResponse.json(team, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 });
    } else {
      return NextResponse.json({ error: err }, { status: 500 });
    }
  }
}


export async function PUT(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    const validatedData = updateTeamParams.parse(await req.json());
    const validatedParams = teamIdSchema.parse({ id });

    const { team, error } = await updateTeam(validatedParams.id, validatedData);

    if (error) return NextResponse.json({ error }, { status: 500 });
    return NextResponse.json(team, { status: 200 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 });
    } else {
      return NextResponse.json(err, { status: 500 });
    }
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    const validatedParams = teamIdSchema.parse({ id });
    const { team, error } = await deleteTeam(validatedParams.id);
    if (error) return NextResponse.json({ error }, { status: 500 });

    return NextResponse.json(team, { status: 200 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 });
    } else {
      return NextResponse.json(err, { status: 500 });
    }
  }
}
