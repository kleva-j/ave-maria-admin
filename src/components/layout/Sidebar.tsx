import { Aside, Title, MediaQuery } from '@mantine/core';
import { TimeLine } from 'components/admin/Timeline';

export const PageSidebar = () => {
  return (
    <MediaQuery smallerThan="md" styles={{ display: 'none' }}>
      <Aside p="md" hiddenBreakpoint="sm" width={{ sm: 200, lg: 300 }}>
        <Title order={4} my="md">
          Event Timeline
        </Title>
        <TimeLine />
      </Aside>
    </MediaQuery>
  );
};
