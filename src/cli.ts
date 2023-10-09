import { program, Option } from 'commander';
import { version, description } from '../package.json';
import { Reader, type Format } from './main'

program
  .description(description)
  .argument('<input dir>', 'path to the image files directory')
  .version(version)
  .addOption(
    new Option('-f, --format <type>', 'output format')
      .choices(['gpx', 'geojson'] as Format[])
      .default('gpx' as Format)
    )

program.parse()

const { format }: { format: Format } = program.opts();
const input_dir = program.args[0];


const main = async () => {
  const reader = new Reader(input_dir, { format });
  await reader.read();
  await reader.write();
}

main()
