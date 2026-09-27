import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Size Guide — ROOT',
  description:
    'Find your perfect fit with our comprehensive men and women apparel measurement charts.',
};

export default function SizeGuidePage(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-screen-md px-4 py-12 md:px-8 md:py-20">
      <h1 className="font-display text-primary text-4xl font-bold tracking-tight md:text-5xl">
        Size & Fit Guide
      </h1>
      <p className="mt-4 text-sm text-neutral-600">
        All measurements are listed in inches. If you fall between sizes, we recommend sizing up for
        a relaxed drape or sizing down for a tailored silhouette.
      </p>

      {/* Men's Tops & Outerwear */}
      <div className="mt-10">
        <h2 className="font-display text-primary text-xl font-bold">Men&apos;s Tops & Outerwear</h2>
        <div className="mt-4 overflow-hidden rounded-lg border border-neutral-200">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-neutral-200 bg-neutral-50 font-semibold uppercase tracking-wider text-neutral-900">
              <tr>
                <th className="px-4 py-3">Size</th>
                <th className="px-4 py-3">Chest (in)</th>
                <th className="px-4 py-3">Waist (in)</th>
                <th className="px-4 py-3">Neck (in)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 bg-white">
              <tr>
                <td className="px-4 py-3 font-semibold text-neutral-900">XS</td>
                <td className="px-4 py-3">34 - 36</td>
                <td className="px-4 py-3">28 - 30</td>
                <td className="px-4 py-3">14 - 14.5</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-semibold text-neutral-900">S</td>
                <td className="px-4 py-3">36 - 38</td>
                <td className="px-4 py-3">30 - 32</td>
                <td className="px-4 py-3">14.5 - 15</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-semibold text-neutral-900">M</td>
                <td className="px-4 py-3">38 - 40</td>
                <td className="px-4 py-3">32 - 34</td>
                <td className="px-4 py-3">15.5 - 16</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-semibold text-neutral-900">L</td>
                <td className="px-4 py-3">41 - 43</td>
                <td className="px-4 py-3">35 - 37</td>
                <td className="px-4 py-3">16.5 - 17</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-semibold text-neutral-900">XL</td>
                <td className="px-4 py-3">44 - 46</td>
                <td className="px-4 py-3">38 - 40</td>
                <td className="px-4 py-3">17.5 - 18</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-semibold text-neutral-900">XXL</td>
                <td className="px-4 py-3">47 - 49</td>
                <td className="px-4 py-3">41 - 43</td>
                <td className="px-4 py-3">18.5 - 19</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Women's Apparel */}
      <div className="mt-12">
        <h2 className="font-display text-primary text-xl font-bold">Women&apos;s Apparel</h2>
        <div className="mt-4 overflow-hidden rounded-lg border border-neutral-200">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-neutral-200 bg-neutral-50 font-semibold uppercase tracking-wider text-neutral-900">
              <tr>
                <th className="px-4 py-3">Size (US)</th>
                <th className="px-4 py-3">Bust (in)</th>
                <th className="px-4 py-3">Waist (in)</th>
                <th className="px-4 py-3">Hips (in)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 bg-white">
              <tr>
                <td className="px-4 py-3 font-semibold text-neutral-900">XS (0-2)</td>
                <td className="px-4 py-3">32 - 33</td>
                <td className="px-4 py-3">24 - 25</td>
                <td className="px-4 py-3">34 - 35</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-semibold text-neutral-900">S (4-6)</td>
                <td className="px-4 py-3">34 - 35</td>
                <td className="px-4 py-3">26 - 27</td>
                <td className="px-4 py-3">36 - 37</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-semibold text-neutral-900">M (8-10)</td>
                <td className="px-4 py-3">36 - 37</td>
                <td className="px-4 py-3">28 - 29</td>
                <td className="px-4 py-3">38 - 39</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-semibold text-neutral-900">L (12-14)</td>
                <td className="px-4 py-3">38.5 - 40</td>
                <td className="px-4 py-3">30.5 - 32</td>
                <td className="px-4 py-3">40.5 - 42</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-semibold text-neutral-900">XL (16)</td>
                <td className="px-4 py-3">41.5 - 43</td>
                <td className="px-4 py-3">33.5 - 35</td>
                <td className="px-4 py-3">43.5 - 45</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
