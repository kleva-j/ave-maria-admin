import {
  RingProgress,
  Divider,
  Button,
  Center,
  Stack,
  Card,
  Text,
} from '@mantine/core';

export const CardRing = () => {
  return (
    <Card radius="sm" sx={{ height: 360 }} withBorder>
      <Center sx={{ height: '100%' }}>
        <Stack>
          <RingProgress
            sections={[{ value: 40, color: 'blue' }]}
            size={170}
            sx={{ margin: 'auto' }}
            label={
              <Text color="blue" weight={700} align="center" size="xl">
                40%
              </Text>
            }
          />
          <Text size="sm" weight={600} align="center">
            Returning customer rate
          </Text>
          <Divider size="xs" />
          <Text size="lg" weight={600} align="center">
            65%
          </Text>
          <Text size="xs" mt={-15} color="dimmed" align="center">
            First-time purchase
          </Text>
          <Button size="xs">Boost returning customer rate</Button>
        </Stack>
      </Center>
    </Card>
  );
};
