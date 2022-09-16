export {};

// import { BookingStatus, MembershipRole, Prisma, UserPermissionRole, UserPlan } from "@prisma/client";

// import dailyMeta from "@calcom/app-store/dailyvideo/_metadata";
// import googleMeetMeta from "@calcom/app-store/googlevideo/_metadata";
// import zoomMeta from "@calcom/app-store/zoomvideo/_metadata";
// import dayjs from "@calcom/dayjs";
// import { hashPassword } from "@calcom/lib/auth";
// import { DEFAULT_SCHEDULE, getAvailabilityFromSchedule } from "@calcom/lib/availability";

// import prisma from ".";
// import mainAppStore from "./seed-app-store";

// async function createTeamAndAddUsers(
//   teamInput: Prisma.TeamCreateInput,
//   users: { id: number; username: string; role?: MembershipRole }[]
// ) {
//   const createTeam = async (team: Prisma.TeamCreateInput) => {
//     try {
//       return await prisma.team.create({
//         data: {
//           ...team,
//         },
//       });
//     } catch (_err) {
//       if (_err instanceof Error && _err.message.indexOf("Unique constraint failed on the fields") !== -1) {
//         console.log(`Team '${team.name}' already exists, skipping.`);
//         return;
//       }
//       throw _err;
//     }
//   };

//   const team = await createTeam(teamInput);
//   if (!team) {
//     return;
//   }

//   console.log(
//     `🏢 Created team '${teamInput.name}' - ${process.env.NEXT_PUBLIC_WEBAPP_URL}/team/${team.slug}`
//   );

//   for (const user of users) {
//     const { role = MembershipRole.OWNER, id, username } = user;
//     await prisma.membership.create({
//       data: {
//         teamId: team.id,
//         userId: id,
//         role: role,
//         accepted: true,
//       },
//     });
//     console.log(`\t👤 Added '${teamInput.name}' membership for '${username}' with role '${role}'`);
//   }
// }

// async function main() {
//   await createUserAndEventType({
//     user: {
//       email: "delete-me@example.com",
//       password: "delete-me",
//       username: "delete-me",
//       name: "delete-me",
//       plan: "FREE",
//     },
//     eventTypes: [],
//   });

//   await createUserAndEventType({
//     user: {
//       email: "onboarding@example.com",
//       password: "onboarding",
//       username: "onboarding",
//       name: "onboarding",
//       plan: "TRIAL",
//       completedOnboarding: false,
//     },
//     eventTypes: [],
//   });

//   await createUserAndEventType({
//     user: {
//       email: "free-first-hidden@example.com",
//       password: "free-first-hidden",
//       username: "free-first-hidden",
//       name: "Free First Hidden Example",
//       plan: "FREE",
//     },
//     eventTypes: [
//       {
//         title: "30min",
//         slug: "30min",
//         length: 30,
//         hidden: true,
//       },
//       {
//         title: "60min",
//         slug: "60min",
//         length: 30,
//       },
//     ],
//   });
//   await createUserAndEventType({
//     user: {
//       email: "pro@example.com",
//       name: "Pro Example",
//       password: "pro",
//       username: "pro",
//       plan: "PRO",
//     },
//     eventTypes: [
//       {
//         title: "30min",
//         slug: "30min",
//         length: 30,
//         _bookings: [
//           {
//             uid: uuid(),
//             title: "30min",
//             startTime: dayjs().add(1, "day").toDate(),
//             endTime: dayjs().add(1, "day").add(30, "minutes").toDate(),
//           },
//           {
//             uid: uuid(),
//             title: "30min",
//             startTime: dayjs().add(2, "day").toDate(),
//             endTime: dayjs().add(2, "day").add(30, "minutes").toDate(),
//             status: BookingStatus.PENDING,
//           },
//         ],
//       },
//       {
//         title: "60min",
//         slug: "60min",
//         length: 60,
//       },
//       {
//         title: "paid",
//         slug: "paid",
//         length: 60,
//         price: 100,
//       },
//       {
//         title: "In person meeting",
//         slug: "in-person",
//         length: 60,
//         locations: [{ type: "inPerson", address: "London" }],
//       },
//       {
//         title: "Zoom Event",
//         slug: "zoom",
//         length: 60,
//         locations: [{ type: zoomMeta.appData?.location.type }],
//       },
//       {
//         title: "Daily Event",
//         slug: "daily",
//         length: 60,
//         locations: [{ type: dailyMeta.appData?.location.type }],
//       },
//       {
//         title: "Google Meet",
//         slug: "google-meet",
//         length: 60,
//         locations: [{ type: googleMeetMeta.appData?.location.type }],
//       },
//       {
//         title: "Yoga class",
//         slug: "yoga-class",
//         length: 30,
//         recurringEvent: { freq: 2, count: 12, interval: 1 },
//         _bookings: [
//           {
//             uid: uuid(),
//             title: "Yoga class",
//             recurringEventId: Buffer.from("yoga-class").toString("base64"),
//             startTime: dayjs().add(1, "day").toDate(),
//             endTime: dayjs().add(1, "day").add(30, "minutes").toDate(),
//             status: BookingStatus.PENDING,
//           },
//           {
//             uid: uuid(),
//             title: "Yoga class",
//             recurringEventId: Buffer.from("yoga-class").toString("base64"),
//             startTime: dayjs().add(1, "day").add(1, "week").toDate(),
//             endTime: dayjs().add(1, "day").add(1, "week").add(30, "minutes").toDate(),
//             status: BookingStatus.PENDING,
//           },
//           {
//             uid: uuid(),
//             title: "Yoga class",
//             recurringEventId: Buffer.from("yoga-class").toString("base64"),
//             startTime: dayjs().add(1, "day").add(2, "week").toDate(),
//             endTime: dayjs().add(1, "day").add(2, "week").add(30, "minutes").toDate(),
//             status: BookingStatus.PENDING,
//           },
//           {
//             uid: uuid(),
//             title: "Yoga class",
//             recurringEventId: Buffer.from("yoga-class").toString("base64"),
//             startTime: dayjs().add(1, "day").add(3, "week").toDate(),
//             endTime: dayjs().add(1, "day").add(3, "week").add(30, "minutes").toDate(),
//             status: BookingStatus.PENDING,
//           },
//           {
//             uid: uuid(),
//             title: "Yoga class",
//             recurringEventId: Buffer.from("yoga-class").toString("base64"),
//             startTime: dayjs().add(1, "day").add(4, "week").toDate(),
//             endTime: dayjs().add(1, "day").add(4, "week").add(30, "minutes").toDate(),
//             status: BookingStatus.PENDING,
//           },
//           {
//             uid: uuid(),
//             title: "Yoga class",
//             recurringEventId: Buffer.from("yoga-class").toString("base64"),
//             startTime: dayjs().add(1, "day").add(5, "week").toDate(),
//             endTime: dayjs().add(1, "day").add(5, "week").add(30, "minutes").toDate(),
//             status: BookingStatus.PENDING,
//           },
//         ],
//       },
//       {
//         title: "Tennis class",
//         slug: "tennis-class",
//         length: 60,
//         recurringEvent: { freq: 2, count: 10, interval: 2 },
//         requiresConfirmation: true,
//         _bookings: [
//           {
//             uid: uuid(),
//             title: "Tennis class",
//             recurringEventId: Buffer.from("tennis-class").toString("base64"),
//             startTime: dayjs().add(2, "day").toDate(),
//             endTime: dayjs().add(2, "day").add(60, "minutes").toDate(),
//             status: BookingStatus.PENDING,
//           },
//           {
//             uid: uuid(),
//             title: "Tennis class",
//             recurringEventId: Buffer.from("tennis-class").toString("base64"),
//             startTime: dayjs().add(2, "day").add(2, "week").toDate(),
//             endTime: dayjs().add(2, "day").add(2, "week").add(60, "minutes").toDate(),
//             status: BookingStatus.PENDING,
//           },
//           {
//             uid: uuid(),
//             title: "Tennis class",
//             recurringEventId: Buffer.from("tennis-class").toString("base64"),
//             startTime: dayjs().add(2, "day").add(4, "week").toDate(),
//             endTime: dayjs().add(2, "day").add(4, "week").add(60, "minutes").toDate(),
//             status: BookingStatus.PENDING,
//           },
//           {
//             uid: uuid(),
//             title: "Tennis class",
//             recurringEventId: Buffer.from("tennis-class").toString("base64"),
//             startTime: dayjs().add(2, "day").add(8, "week").toDate(),
//             endTime: dayjs().add(2, "day").add(8, "week").add(60, "minutes").toDate(),
//             status: BookingStatus.PENDING,
//           },
//           {
//             uid: uuid(),
//             title: "Tennis class",
//             recurringEventId: Buffer.from("tennis-class").toString("base64"),
//             startTime: dayjs().add(2, "day").add(10, "week").toDate(),
//             endTime: dayjs().add(2, "day").add(10, "week").add(60, "minutes").toDate(),
//             status: BookingStatus.PENDING,
//           },
//         ],
//       },
//     ],
//   });

//   await createUserAndEventType({
//     user: {
//       email: "trial@example.com",
//       password: "trial",
//       username: "trial",
//       name: "Trial Example",
//       plan: "TRIAL",
//     },
//     eventTypes: [
//       {
//         title: "30min",
//         slug: "30min",
//         length: 30,
//       },
//       {
//         title: "60min",
//         slug: "60min",
//         length: 60,
//       },
//     ],
//   });

//   await createUserAndEventType({
//     user: {
//       email: "free@example.com",
//       password: "free",
//       username: "free",
//       name: "Free Example",
//       plan: "FREE",
//     },
//     eventTypes: [
//       {
//         title: "30min",
//         slug: "30min",
//         length: 30,
//       },
//       {
//         title: "60min",
//         slug: "60min",
//         length: 30,
//       },
//     ],
//   });

//   await createUserAndEventType({
//     user: {
//       email: "usa@example.com",
//       password: "usa",
//       username: "usa",
//       name: "USA Timezone Example",
//       plan: "FREE",
//       timeZone: "America/Phoenix",
//     },
//     eventTypes: [
//       {
//         title: "30min",
//         slug: "30min",
//         length: 30,
//       },
//     ],
//   });

//   const freeUserTeam = await createUserAndEventType({
//     user: {
//       email: "teamfree@example.com",
//       password: "teamfree",
//       username: "teamfree",
//       name: "Team Free Example",
//       plan: "FREE",
//     },
//     eventTypes: [],
//   });

//   const proUserTeam = await createUserAndEventType({
//     user: {
//       email: "teampro@example.com",
//       password: "teampro",
//       username: "teampro",
//       name: "Team Pro Example",
//       plan: "PRO",
//     },
//     eventTypes: [],
//   });

//   await createUserAndEventType({
//     user: {
//       email: "admin@example.com",
//       password: "admin",
//       username: "admin",
//       name: "Admin Example",
//       plan: "PRO",
//       role: "ADMIN",
//     },
//     eventTypes: [],
//   });

//   const pro2UserTeam = await createUserAndEventType({
//     user: {
//       email: "teampro2@example.com",
//       password: "teampro2",
//       username: "teampro2",
//       name: "Team Pro Example 2",
//       plan: "PRO",
//     },
//     eventTypes: [],
//   });

//   const pro3UserTeam = await createUserAndEventType({
//     user: {
//       email: "teampro3@example.com",
//       password: "teampro3",
//       username: "teampro3",
//       name: "Team Pro Example 3",
//       plan: "PRO",
//     },
//     eventTypes: [],
//   });

//   const pro4UserTeam = await createUserAndEventType({
//     user: {
//       email: "teampro4@example.com",
//       password: "teampro4",
//       username: "teampro4",
//       name: "Team Pro Example 4",
//       plan: "PRO",
//     },
//     eventTypes: [],
//   });

//   await createTeamAndAddUsers(
//     {
//       name: "Seeded Team",
//       slug: "seeded-team",
//       eventTypes: {
//         createMany: {
//           data: [
//             {
//               title: "Collective Seeded Team Event",
//               slug: "collective-seeded-team-event",
//               length: 15,
//               schedulingType: "COLLECTIVE",
//             },
//             {
//               title: "Round Robin Seeded Team Event",
//               slug: "round-robin-seeded-team-event",
//               length: 15,
//               schedulingType: "ROUND_ROBIN",
//             },
//           ],
//         },
//       },
//     },
//     [
//       {
//         id: proUserTeam.id,
//         username: proUserTeam.name || "Unknown",
//       },
//       {
//         id: freeUserTeam.id,
//         username: freeUserTeam.name || "Unknown",
//       },
//       {
//         id: pro2UserTeam.id,
//         username: pro2UserTeam.name || "Unknown",
//         role: "MEMBER",
//       },
//       {
//         id: pro3UserTeam.id,
//         username: pro3UserTeam.name || "Unknown",
//       },
//       {
//         id: pro4UserTeam.id,
//         username: pro4UserTeam.name || "Unknown",
//       },
//     ]
//   );
// }

// main()
//   .then(() => mainAppStore())
//   .catch((e) => {
//     console.error(e);
//     process.exit(1);
//   })
//   .finally(async () => {
//     await prisma.$disconnect();
//   });
