import { Avatar, Table, Group, Badge, Text, Box } from '@mantine/core';
import { femaleImageUrl, isValidDate } from 'helpers';
import { User, Post, Card } from '@prisma/client';

import { MoreAction } from './MoreAction';

interface Props {
  userList?: (User & {
    posts: Post[];
    cards: Card[];
  })[];
}

const columnTitle = [
  '#',
  'name',
  'role',
  'date added',
  'cards',
  'posts',
  'last active',
  '',
];

export const TableComponent = ({ userList = [] }: Props) => {
  return (
    <Table>
      <thead>
        <tr>
          {columnTitle.map((item) => (
            <th key={item}>
              <Text color="dimmed" style={{ fontSize: '0.675rem' }}>
                {item.toUpperCase()}
              </Text>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {userList.map((item, index) => {
          const {
            name,
            role,
            email,
            image,
            posts,
            cards,
            createdAt,
            updatedAt,
            emailVerified,
          } = item;
          const isVerified = isValidDate(emailVerified);

          return (
            <tr key={item.email}>
              <td>
                <Text>{index + 1}</Text>
              </td>
              <td>
                <Group>
                  <Avatar src={image ?? femaleImageUrl} radius="xl" />
                  <Box sx={{ flex: 1 }}>
                    <Group>
                      <Text size="sm" weight={500}>
                        {name}
                      </Text>
                      <Badge
                        size="xs"
                        color={!isVerified ? 'red' : 'teal'}
                        variant="outline"
                      >
                        {!isVerified ? 'not verified' : 'verified'}
                      </Badge>
                    </Group>
                    <Text color="dimmed" size="xs">
                      {email}
                    </Text>
                  </Box>
                </Group>
              </td>
              <td>
                <Text>
                  <Badge>{role}</Badge>
                </Text>
              </td>
              <td>
                <Text size="xs">
                  {new Date(createdAt ?? Date.now()).toLocaleDateString(
                    'en-GB',
                  )}
                </Text>
              </td>
              <td>
                <Text>{cards.length}</Text>
              </td>
              <td>
                <Text>{posts.length}</Text>
              </td>
              <td>
                <Text size="xs">
                  {new Date(updatedAt ?? Date.now()).toLocaleDateString(
                    'en-GB',
                  )}
                </Text>
              </td>
              <td>
                <MoreAction />
              </td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
};
