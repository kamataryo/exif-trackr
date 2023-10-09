import fs from 'node:fs/promises'
import path from 'node:path'
import exifr from 'exifr'

export type Format = 'gpx' | 'geojson';

type Metadata = {
  date: Date,
  lat: number,
  lng: number,
  alt: number | null,
}

type Options = {
  format: Format,
  recursive: boolean,
}

export class Reader {
  public metadatas: Metadata[] = [];

  constructor(
    private input_dir: string,
    private opts: Options,
  ) {}

  public async read(dir = this.input_dir): Promise<void> {
    this.metadatas.splice(0, this.metadatas.length);

    const dirnames = await fs.readdir(dir);
    for (const dirname of dirnames) {
      const dir_path = path.join(dir, dirname);
      const stat = await fs.stat(dir_path);
      if(stat.isDirectory()) {
        if(this.opts.recursive) {
          await this.read(dir_path);
        }
        continue;
      } else {
        const metadata = await this.read_exif(dir_path);
        if(metadata.date !== null && metadata.lat !== null && metadata.lng !== null) {
          this.metadatas.push(metadata as Metadata)
        }
      }
    }
    this.metadatas.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  public async write(): Promise<void> {
    let result = '';
    switch(this.opts.format) {
      case 'gpx': {
        result = `<?xml version="1.0" encoding="UTF-8" ?>
<gpx version="1.1" creator="kamataryo/exif-trackr">
<metadata>
  <link href="https://github.com/kamataryo/exif-trackr">Exif Trackr</link>
</metadata>
<trk>
  ${this.metadatas.map((metadata) => `<trkseg>
  <trkpt lat="${metadata.lat}" lon="${metadata.lng}">
    ${metadata.alt === null ? '' : `<ele>${metadata.alt}</ele>`}
    <time>${metadata.date.toISOString()}</time>
  </trkpt>
</trkseg>`).join('')}
</trk>
</gpx>`;
        break;
      }
      case 'geojson': {
        const geojson: GeoJSON.FeatureCollection<GeoJSON.LineString> = {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: {
                times: this.metadatas.map((metadata) => metadata.date.toISOString()),
                altitudes: this.metadatas.map((metadata) => metadata.alt),
              },
              geometry: {
                type: 'LineString',
                coordinates: this.metadatas.map((metadata) => [metadata.lng, metadata.lat]),
              }
            }
          ]
        }
        result = JSON.stringify(geojson, null, 2);
        break;
      }
    }
    process.stdout.write(result + '\n');
  }

  private async read_exif(file_path: string): Promise<Metadata | {
    date: Date | null,
    lat: number | null,
    lng: number | null,
  }> {
    const [
      { DateTimeOriginal: date, GPSAltitude: alt },
      { latitude: lat, longitude: lng },
    ] = await Promise.all([
      exifr.parse(file_path, ['DateTimeOriginal', 'GPSAltitude']),
      exifr.gps(file_path),
    ]);

    return {
      date: date ? date : null,
      lat: lat ? lat : null,
      lng: lng ? lng : null,
      alt: alt ? alt : null,
    }
  }
}
