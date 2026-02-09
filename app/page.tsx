"use client";

import { useState } from "react";
import Papa from "papaparse";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

export default function Home() {
  const [data, setData] = useState<any[]>([]);

  const handleFileUpload = (e: any) => {
    const file = e.target.files[0];

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: function (results) {
        setData(results.data);
      },
    });
  };

  return (
    <main style={{ padding: "40px", fontFamily: "sans-serif" }}>
      <h1>KPC AI Dashboard</h1>

      <input type="file" accept=".csv" onChange={handleFileUpload} />

      {data.length > 0 && (
        <div style={{ width: "100%", height: "400px", marginTop: "40px" }}>
          <ResponsiveContainer>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={Object.keys(data[0])[0]} />
              <YAxis />
              <Tooltip />
              <Line
                type="monotone"
                dataKey={Object.keys(data[0])[1]}
                stroke="#8884d8"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </main>
  );
}
