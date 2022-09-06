import { Divider, Tabs } from '@mantine/core';

import { MemberGroup } from './MemberGroup';

const sampleUserList = [
  {
    name: 'Isla Watson',
    created_at: new Date(2020, 1, 3),
    last_active: new Date(),
    role: 'user',
    email: 'kasmickleva@gmail.com',
  },
  {
    name: 'Donald Lee',
    created_at: new Date(2020, 3, 4),
    last_active: new Date(),
    email: 'kasmickleva@gmail.com',
    role: 'user',
  },
  {
    name: 'Justin Bennett',
    created_at: new Date(2020, 5, 5),
    last_active: new Date(),
    email: 'kasmickleva@gmail.com',
    role: 'user',
  },
  {
    name: 'Sarah Evans',
    created_at: new Date(2020, 7, 6),
    last_active: new Date(),
    email: 'kasmickleva@gmail.com',
    role: 'user',
  },
  {
    name: 'Benjamin Allen',
    created_at: new Date(2020, 9, 7),
    last_active: new Date(),
    email: 'kasmickleva@gmail.com',
    role: 'user',
  },
];

export const Members = () => {
  const handleUpdate = () => () => '';
  const handleDelete = () => () => '';
  const handleDownload = () => () => '';

  return (
    <Tabs.Panel value="members" pt="xs">
      <MemberGroup
        title="Members"
        group="administrator"
        userList={sampleUserList}
        description="Invite your team members to work faster and collaborate easily together. Manage their permissions to better structure projects"
        handleUpdate={handleUpdate}
        handleDelete={handleDelete}
        handleDownload={handleDownload}
      ></MemberGroup>
      <Divider />
      <MemberGroup
        title="Guest accounts"
        group="guest"
        description="Guest accounts allow your external partners to collaborate and communicate with you here"
        userList={sampleUserList.slice(4)}
        handleUpdate={handleUpdate}
        handleDelete={handleDelete}
        handleDownload={handleDownload}
      ></MemberGroup>
      <Divider />
      <MemberGroup
        title="Pending Invites"
        group="pending"
        description="Manage invitations that are yet to be confirmed here."
        userList={sampleUserList.slice(3)}
        handleUpdate={handleUpdate}
        handleDelete={handleDelete}
        handleDownload={handleDownload}
      ></MemberGroup>
    </Tabs.Panel>
  );
};
