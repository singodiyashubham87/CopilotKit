'use client'

import React, { useState, ReactNode, useCallback } from 'react'
import { AnnotatedFunction } from './use-make-copilot-actionable'
import useTree, { TreeNodeId } from './use-tree'
import { ChatCompletionFunctions } from 'openai-edge/types/api'
import { FunctionCallHandler } from 'ai'

export interface CopilotContextParams {
  entryPoints: Record<string, AnnotatedFunction<any[]>>
  getChatCompletionFunctions: () => ChatCompletionFunctions[]
  getFunctionCallHandler: () => FunctionCallHandler
  setEntryPoint: (id: string, entryPoint: AnnotatedFunction<any[]>) => void
  removeEntryPoint: (id: string) => void

  getContextString: () => string
  addContext: (context: string, parentId?: string) => TreeNodeId
  removeContext: (id: TreeNodeId) => void
}
export const CopilotContext = React.createContext<CopilotContextParams>(
  {} as CopilotContextParams
)

export function CopilotProvider({
  children
}: {
  children: ReactNode
}): JSX.Element {
  const [entryPoints, setEntryPoints] = useState<
    Record<string, AnnotatedFunction<any[]>>
  >({})

  const { addElement, removeElement, printTree } = useTree()

  const setEntryPoint = useCallback(
    (id: string, entryPoint: AnnotatedFunction<any[]>) => {
      setEntryPoints(prevPoints => {
        return {
          ...prevPoints,
          [id]: entryPoint
        }
      })
    },
    []
  )

  const removeEntryPoint = useCallback((id: string) => {
    setEntryPoints(prevPoints => {
      const newPoints = { ...prevPoints }
      delete newPoints[id]
      return newPoints
    })
  }, [])

  const getContextString = useCallback(() => {
    return printTree()
  }, [printTree])

  const addContext = useCallback(
    (context: string, parentId?: string) => {
      return addElement(context, parentId)
    },
    [addElement]
  )

  const removeContext = useCallback(
    (id: string) => {
      removeElement(id)
    },
    [removeElement]
  )

  const getChatCompletionFunctions = useCallback(() => {
    return entryPointsToChatCompletionFunctions(Object.values(entryPoints))
  }, [entryPoints])

  const getFunctionCallHandler = useCallback(() => {
    return entryPointsToFunctionCallHandler(Object.values(entryPoints))
  }, [entryPoints])

  return (
    <CopilotContext.Provider
      value={{
        entryPoints,
        getChatCompletionFunctions,
        getFunctionCallHandler,
        setEntryPoint,
        removeEntryPoint,
        getContextString,
        addContext,
        removeContext
      }}
    >
      {children}
    </CopilotContext.Provider>
  )
}

function entryPointsToFunctionCallHandler(
  entryPoints: AnnotatedFunction<any[]>[]
): FunctionCallHandler {
  return async (chatMessages, functionCall) => {
    let entrypointsByFunctionName: Record<string, AnnotatedFunction<any[]>> = {}
    for (let entryPoint of entryPoints) {
      entrypointsByFunctionName[entryPoint.name] = entryPoint
    }

    const entryPointFunction = entrypointsByFunctionName[functionCall.name]
    if (entryPointFunction) {
      let parsedFunctionCallArguments: any[] = []
      if (functionCall.arguments) {
        parsedFunctionCallArguments = JSON.parse(functionCall.arguments)
      }

      await entryPointFunction.implementation(...parsedFunctionCallArguments)

      // commented out becasue for now we don't want to return anything
      // const result = await entryPointFunction.implementation(
      //   ...parsedFunctionCallArguments
      // );
      // const functionResponse: ChatRequest = {
      //   messages: [
      //     ...chatMessages,
      //     {
      //       id: nanoid(),
      //       name: functionCall.name,
      //       role: 'function' as const,
      //       content: JSON.stringify(result),
      //     },
      //   ],
      // };

      // return functionResponse;
    }
  }
}

function entryPointsToChatCompletionFunctions(
  entryPoints: AnnotatedFunction<any[]>[]
): ChatCompletionFunctions[] {
  return entryPoints.map(annotatedFunctionToChatCompletionFunction)
}

function annotatedFunctionToChatCompletionFunction(
  annotatedFunction: AnnotatedFunction<any[]>
): ChatCompletionFunctions {
  // Create the parameters object based on the argumentAnnotations
  let parameters: { [key: string]: any } = {}
  for (let arg of annotatedFunction.argumentAnnotations) {
    parameters[arg.name] = { type: arg.type, description: arg.description }
  }

  // Create the ChatCompletionFunctions object
  let chatCompletionFunction: ChatCompletionFunctions = {
    name: annotatedFunction.name,
    description: annotatedFunction.description,
    parameters: parameters
  }

  return chatCompletionFunction
}
