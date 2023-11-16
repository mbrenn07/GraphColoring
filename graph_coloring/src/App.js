import { useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Line, PerspectiveCamera } from '@react-three/drei'
import { Box, Button, Stack, TextField } from '@mui/material'
import _ from 'lodash'

function ThreeVertex({ position, color }) {
  return (
    <mesh
      position={position}
    >
      <sphereGeometry args={[1, 32, 16]} />
      <meshStandardMaterial color={color} />
    </mesh>
  )
}

function ThreeEdge({ color, points }) {
  return (
    <Line
      points={points}
      color={color}
      lineWidth={5}
    />
  )
}

function createNewGraph(numPoints, numEdges, numColors, scalarFactor, setEdges, setVertices) {
  const colorOptions = ["#e60049", "#0bb4ff", "#50e991", "#e6d800", "#9b19f5", "#ffa300", "#dc0ab4", "#b3d4ff", "#00bfa0"];

  if (numColors > colorOptions.length) {
    alert("That's too many colors! This stuff is hardcoded!");
    return;
  }

  const edges = [];
  const vertices = [];

  while (vertices.length < numPoints) {
    let x = Math.floor(Math.random() * numPoints * scalarFactor);
    let y = Math.floor(Math.random() * numPoints * scalarFactor);
    let z = Math.floor(Math.random() * numPoints * scalarFactor);
    let color = Math.floor(Math.random() * numColors);
    //if the point is not already in the graph
    if (!vertices.some((vertex) => vertex.position[0] === x && vertex.position[1] === y && vertex.position[2] === z)) {
      vertices.push({ position: [x, y, z], color: colorOptions[color] });
    }
  }

  let i = 0;

  while (edges.length < numEdges) {
    i++;
    let edge1 = Math.floor(Math.random() * numPoints);
    let edge2 = Math.floor(Math.random() * numPoints);

    //we calculate edge distance to encourage the graph to be more connected
    let xDifference = vertices[edge1].position[0] - vertices[edge2].position[0];
    let yDifference = vertices[edge1].position[1] - vertices[edge2].position[1];
    let zDifference = vertices[edge1].position[2] - vertices[edge2].position[2];
    let edgeDistance = Math.sqrt((xDifference * xDifference) + (yDifference * yDifference) + (zDifference * zDifference));
    if (i > 500) {
      //we've spent so long looking for optimal edges that we're probably out, accept all valid edges from now on
      edgeDistance = 0;
    }
    //if the edge is not already in the graph, and the edge is not to the same point
    if (edgeDistance < 60 && edge1 !== edge2 && !edges.some((edge) => (edge.vertices[0] === edge1 && edge.vertices[1] === edge2)
      || (edge.vertices[0] === edge2 && edge.vertices[1] === edge1))) {
      edges.push({ vertices: [edge1, edge2], color: "black" });
    }
  }

  //calculates which vertices are connected
  const verticesWithEdges = new Set();
  edges.forEach((edge) => {
    verticesWithEdges.add(edge.vertices[0]);
    verticesWithEdges.add(edge.vertices[1]);
  });

  //prunes unconnected vertices
  vertices.forEach((vertex, index) => {
    if (!Array.from(verticesWithEdges).some((vertexWithEdge) => vertexWithEdge === index)) {
      vertices[index] = null;
    }
  });

  setVertices(vertices);
  setEdges(edges);

  return { edges: edges, vertices: vertices };
}

async function checkEdges(edges, vertices, setEdges, initialVertex, distance, delay, color, index) {
  //base case, we never found a same color vertex
  if (distance === 0) {
    return true;
  }

  //get all vertices this connects to
  let connectingEdges = [];
  edges.forEach((edge, index2) => {
    if ((edge.vertices[0] == index || edge.vertices[1] == index)) {
      connectingEdges.push(index2);
    }
  });

  for (let edgeIndex in connectingEdges) {
    if (delay != 0) {
      edges[connectingEdges[edgeIndex]].color = "red";
      setEdges([...edges]);
    }

    if (delay != 0) {
      await new Promise(r => setTimeout(r, delay * 250));
    }

    if (edges[connectingEdges[edgeIndex]].vertices[0] == index) {
      if (vertices[edges[connectingEdges[edgeIndex]].vertices[1]].color === color && !_.isEqual(initialVertex, vertices[edges[connectingEdges[edgeIndex]].vertices[1]])) {
        return false;
      }
      if (!await checkEdges(edges, vertices, setEdges, initialVertex, distance - 1, delay, color, edges[connectingEdges[edgeIndex]].vertices[1])) {
        return false;
      }
    } else {
      if (vertices[edges[connectingEdges[edgeIndex]].vertices[0]].color === color && !_.isEqual(initialVertex, vertices[edges[connectingEdges[edgeIndex]].vertices[0]])) {
        return false;
      }
      if (!await checkEdges(edges, vertices, setEdges, initialVertex, distance - 1, delay, color, edges[connectingEdges[edgeIndex]].vertices[0])) {
        return false;
      }
    }
  };

  //we can't check any valid edges, so there were no matching colors
  return true;
}

async function bruteForceConfirm(edges, vertices, setEdges, distance, delay) {
  for (let index in vertices) {
    let vertex = vertices[index];
    if (vertex != null) {
      if (await checkEdges(edges, vertices, setEdges, vertex, distance, delay, vertex.color, index)) {
        if (delay != 0) {
          edges.forEach((edge) => {
            if (edge.color == "red") {
              edge.color = "green";
            }
          });
          setEdges([...edges]);
        }
      } else {
        return false;
      }
    }
  }
  return true;
}

async function checkEdgesDijkstra(edges, vertices, setEdges, distance, delay, initialIndex, distances, colorGroup) {
  let colorGroupMembersVisited = 0;

  //Steps as per: https://en.wikipedia.org/wiki/Dijkstra%27s_algorithm

  //Step 1
  const unvisited = JSON.parse(JSON.stringify(vertices));
  let index = initialIndex;

  //we can take a shortcut if we've already visited the path between two same-color nodes before
  colorGroup.forEach((colorGroupIndex) => {
    if (distances[[index, colorGroupIndex]]) {
      if (distances[[index, colorGroupIndex]] <= distance) {
        return false;
      } else {
        colorGroupMembersVisited++;
        unvisited[colorGroupIndex] = null;
      }
    } else if (distances[[colorGroupIndex, index]]) {
      if (distances[[colorGroupIndex, index]] <= distance) {
        return false;
      } else {
        colorGroupMembersVisited++;
        unvisited[colorGroupIndex] = null;
      }
    }
  });

  //Step 2
  unvisited.forEach((vertex, index2) => {
    if (vertex != null) {
      if (index == index2) {
        vertex.tenativeDistance = 0;
      } else {
        vertex.tenativeDistance = Infinity;
      }
    }
  });

  while (colorGroupMembersVisited < colorGroup.length) {
    //Step 3
    //get all vertices this connects to
    let connectingEdges = [];
    edges.forEach((edge, index2) => {
      if ((edge.vertices[0] == index || edge.vertices[1] == index) && unvisited[edge.vertices[0]] != null && unvisited[edge.vertices[1]] != null) {
        connectingEdges.push(index2);
      }
    });

    for (let edgeIndex in connectingEdges) {
      if (delay != 0) {
        edges[connectingEdges[edgeIndex]].color = "red";
        setEdges([...edges]);
      }

      if (delay != 0) {
        await new Promise(r => setTimeout(r, delay * 250));
      }

      if (edges[connectingEdges[edgeIndex]].vertices[0] == index) {
        let distance = unvisited[index].tenativeDistance + 1;
        unvisited[edges[connectingEdges[edgeIndex]].vertices[1]].tenativeDistance = Math.min(distance, unvisited[edges[connectingEdges[edgeIndex]].vertices[1]].tenativeDistance);
      } else {
        let distance = unvisited[index].tenativeDistance + 1;
        unvisited[edges[connectingEdges[edgeIndex]].vertices[0]].tenativeDistance = Math.min(distance, unvisited[edges[connectingEdges[edgeIndex]].vertices[0]].tenativeDistance);
      }
    }

    //Step 4
    if (colorGroup.some((colorGroupIndex) => colorGroupIndex == index)) {
      if (unvisited[index].tenativeDistance <= distance && unvisited[index].tenativeDistance != 0) {
        return false;
      }
      distances[[initialIndex, index]] = unvisited[index].tenativeDistance;
      colorGroupMembersVisited++;
      //Step 5a
      if (colorGroupMembersVisited == colorGroup.length) {
        return true;
      }
    }
    unvisited[index] = null;

    let smallestDistance = Infinity;
    unvisited.forEach((vertex, index2) => {
      if (vertex != null) {
        //Step 6
        if (vertex.tenativeDistance < smallestDistance) {
          index = index2;
          smallestDistance = vertex.tenativeDistance;
        }
      }
    });
    //Step 5b
    if (smallestDistance == Infinity) {
      return true;
    }
  }

  //we should never get here
  return true;
}

async function dijkstraConfirm(edges, vertices, setEdges, distance, delay) {
  const distances = {} //this object takes in two vertices, and outputs the distance between them
  const colorGroups = {};
  vertices.forEach((vertex, index) => {
    if (vertex != null) {
      if (colorGroups[vertex.color]) {
        colorGroups[vertex.color].push(index)
      } else {
        colorGroups[vertex.color] = [index];
      }
    }
  });

  edges.forEach((edge) => {
    distances[edge.vertices] = 1;
  });

  for (let index in vertices) {
    let vertex = vertices[index];
    if (vertex != null) {
      if (await checkEdgesDijkstra(edges, vertices, setEdges, distance, delay, index, distances, colorGroups[vertex.color])) {
        if (delay != 0) {
          edges.forEach((edge) => {
            if (edge.color == "red") {
              edge.color = "green";
            }
          });
          setEdges([...edges]);
        }
      } else {
        return false;
      }
    }
  }
  return true;
}

export default function App() {
  const [vertices, setVertices] = useState([]);
  const [edges, setEdges] = useState([]);
  const [numVertices, setNumVertices] = useState(30);
  const [numEdges, setNumEdges] = useState(20);
  const [numColors, setNumColors] = useState(9);
  const [delay, setDelay] = useState(1);
  const [distance, setDistance] = useState(2);

  useEffect(() => {
    createNewGraph(numVertices, numEdges, numColors, 3, setEdges, setVertices);
  }, []);

  return (
    <Stack>
      <Box sx={{ width: "100vw", height: "calc(100vh - 100px)", borderBottom: "black 2px solid" }}>
        <Canvas>
          <PerspectiveCamera position={[100, 100, 150]} makeDefault />
          <ambientLight intensity={Math.PI / 2} />
          <spotLight position={[100, 100, 150]} angle={0.15} penumbra={1} decay={0} intensity={Math.PI} />
          <pointLight position={[100, 100, 150]} decay={0} intensity={Math.PI} />
          {vertices.map((vertex) => {
            if (vertex != null) {
              return (
                <ThreeVertex key={vertex.position[0] + "," + vertex.position[1] + "," + vertex.position[2]} position={vertex.position} color={vertex.color} />
              );
            }
            return null;
          })}
          {edges.map((edge) => {
            if (vertices[edge.vertices[0]] && vertices[edge.vertices[1]]) {
              return (
                <ThreeEdge key={edge.vertices[0] + "," + edge.vertices[1]} points={[vertices[edge.vertices[0]].position, vertices[edge.vertices[1]].position]} color={edge.color} />
              );
            }
            return null;
          })}

          <OrbitControls />
        </Canvas>
      </Box>
      <Box sx={{ width: "100vw", height: 98 }}>
        <Stack direction="row" sx={{ m: 1 }} justifyContent="space-between">
          <Stack direction="row" spacing={1}>
            <Button variant='contained' onClick={async () => {
              createNewGraph(numVertices, numEdges, numColors, 3, setEdges, setVertices);
            }}>
              Generate New Graph
            </Button>
            <Button variant='contained' onClick={async () => {
              let goodGraph = false
              while (!goodGraph) {
                const newGraph = createNewGraph(numVertices, numEdges, numColors, 3, setEdges, setVertices);
                await new Promise(r => setTimeout(r, delay * 50));
                goodGraph = await bruteForceConfirm(newGraph.edges, newGraph.vertices, setEdges, distance, 0);
              }
            }}>
              Generate Low Chromatic Graph 
            </Button>
            <Button variant='contained' onClick={async () => {
              bruteForceConfirm(edges, vertices, setEdges, distance, delay);
            }}>
              Brute Force
            </Button>
            <Button variant='contained' onClick={async () => {
              dijkstraConfirm(edges, vertices, setEdges, distance, delay);
            }}>
              Dijkstra
            </Button>
            <Button color="error" variant='contained' onClick={() => {
              edges.forEach((edge) => {
                edge.color = "black";
              });
              setEdges([...edges]);
            }}>
              Reset Graph
            </Button>
          </Stack>
          <Stack direction="row" spacing={1}>
            <TextField
              sx={{ width: 150 }}
              label="Num Vertices"
              type="number"
              variant="filled"
              value={numVertices}
              onChange={(event) => {
                setNumVertices(event.target.value);
              }}
            />
            <TextField
              sx={{ width: 100 }}
              label="Num Edges"
              type="number"
              variant="filled"
              value={numEdges}
              onChange={(event) => {
                setNumEdges(event.target.value);
              }}
            />
            <TextField
              sx={{ width: 100 }}
              label="Num Colors"
              type="number"
              variant="filled"
              value={numColors}
              onChange={(event) => {
                setNumColors(event.target.value);
              }}
            />
            <TextField
              sx={{ width: 100 }}
              label="Distance"
              type="number"
              variant="filled"
              value={distance}
              onChange={(event) => {
                setDistance(event.target.value);
              }}
            />
            <TextField
              sx={{ width: 150 }}
              label="Rendering Delay"
              type="number"
              variant="filled"
              value={delay}
              onChange={(event) => {
                setDelay(event.target.value);
              }}
            />
            <Button color="error" variant='contained' onClick={() => {
              setNumVertices(30);
              setNumEdges(20);
              setNumColors(9);
              setDistance(2);
              setDelay(1);
            }}>
              Reset Values
            </Button>
          </Stack>
        </Stack>
      </Box>
    </Stack>
  )
}
