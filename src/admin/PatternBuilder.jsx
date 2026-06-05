import { PatternBuilder } from '@spattoo/designer';
import { createPattern } from '../lib/api.js';

export default function AdminPatternBuilder() {
  async function handleSave({ name, slug, placements, tier_count }) {
    return createPattern({ name, slug, placements, tier_count });
  }

  return <PatternBuilder onSave={handleSave} />;
}
