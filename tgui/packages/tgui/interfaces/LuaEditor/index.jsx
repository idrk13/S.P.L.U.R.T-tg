import hljs from 'highlight.js/lib/core';
import lua from 'highlight.js/lib/languages/lua';
import { marked } from 'marked';
import { Component, createRef } from 'react';
import {
  Box,
  Button,
  Flex,
  Modal,
  NoticeBox,
  ProgressBar,
  Section,
  Stack,
  Tabs,
  TextArea,
} from 'tgui-core/components';

import { useBackend, useLocalState } from '../../backend';
import { Window } from '../../layouts';
import { sanitizeText } from '../../sanitize';
import { CallModal } from './CallModal';
import { ChunkViewModal } from './ChunkViewModal';
import { ListMapper } from './ListMapper';
import { Log } from './Log';
import { StateSelectModal } from './StateSelectModal';
import { TaskManager } from './TaskManager';
hljs.registerLanguage('lua', lua);

export class LuaEditor extends Component {
  constructor(props) {
    super(props);
    this.sectionRef = createRef();
    this.state = {
      showJumpToBottomButton: false,
      activeTab: 'tasks',
      scriptInput: '',
    };

    this.handleSectionScroll = () => {
      const { showJumpToBottomButton } = this.state;
      const scrollableCurrent = this.sectionRef.current;
      if (
        !showJumpToBottomButton &&
        scrollableCurrent?.scrollHeight >
          scrollableCurrent?.scrollTop + scrollableCurrent?.clientHeight
      ) {
        this.setState({ showJumpToBottomButton: true });
      } else if (
        showJumpToBottomButton &&
        scrollableCurrent?.scrollTop + scrollableCurrent?.clientHeight >=
          scrollableCurrent?.scrollHeight
      ) {
        this.setState({ showJumpToBottomButton: false });
      }
    };

    window.addEventListener('resize', () =>
      this.forceUpdate(this.handleSectionScroll),
    );
  }

  componentDidMount() {
    const { data } = useBackend();
    const { forceModal, forceViewChunk } = data;
    if (forceModal || forceViewChunk) {
      const [, setModal] = useLocalState('modal');
      const [, setViewedChunk] = useLocalState('viewedChunk');
      setModal(forceModal);
      setViewedChunk(forceViewChunk);
    }
  }

  componentDidUpdate() {
    this.handleSectionScroll();
  }

  render() {
    const { act, data } = useBackend();
    const {
      noStateYet,
      globals,
      documentation,
      tasks,
      showGlobalTable,
      page,
      pageCount,
      auxtools_enabled,
      ss_lua_init,
    } = data;

    if (!auxtools_enabled) {
      return (
        <Window>
          <Window.Content>
            <NoticeBox danger>
              Auxtools is not enabled. Please ask your server administrator to
              enable it in the server configuration.
            </NoticeBox>
          </Window.Content>
        </Window>
      );
    }

    if (!ss_lua_init) {
      return (
        <Window>
          <Window.Content>
            <NoticeBox danger>
              The Lua subsystem is not initialized. Consult your server logs.
            </NoticeBox>
          </Window.Content>
        </Window>
      );
    }

    const [modal, setModal] = useLocalState(
      'modal',
      noStateYet ? 'states' : null,
    );
    const { activeTab, showJumpToBottomButton, scriptInput } = this.state;
    let tabContent;
    switch (activeTab) {
      case 'globals': {
        if (!globals) {
          tabContent = (
            <h1>
              Could not retrieve the global table. Was it corrupted or shadowed?
            </h1>
          );
        } else {
          tabContent = (
            <ListMapper
              list={globals}
              skipNulls
              vvAct={(path) => act('vvGlobal', { indices: path })}
              callType="callFunction"
            />
          );
        }
        break;
      }
      case 'tasks': {
        if (!tasks) {
          tabContent = (
            <h1>
              Could not retrieve task info. Was the global table corrupted or
              shadowed?
            </h1>
          );
        } else {
          tabContent = <TaskManager />;
        }
        break;
      }
      case 'log': {
        tabContent = <Log />;
        break;
      }
    }

    return (
      <Window width={1280} height={720}>
        <Window.Content>
          <Button icon="file" onClick={() => setModal('states')}>
            States
          </Button>
          {noStateYet ? (
            <Flex
              width="100%"
              height="100%"
              align="center"
              justify="space-around"
            >
              <h1>Please select or create a lua state to get started.</h1>
            </Flex>
          ) : (
            <Stack height="calc(100% - 16px)">
              <Stack.Item grow shrink basis="55%">
                <Section
                  fill
                  pb="16px"
                  title="Input"
                  buttons={
                    <>
                      <Button onClick={() => act('runCodeFile')}>Import</Button>
                      <Button onClick={() => setModal('documentation')}>
                        Help
                      </Button>
                    </>
                  }
                >
                  <TextArea
                    fluid
                    width="100%"
                    height="100%"
                    value={scriptInput}
                    fontFamily="Consolas"
                    onInput={(_, value) =>
                      this.setState({ scriptInput: value })
                    }
                    displayedValue={
                      <Box
                        style={{
                          pointerEvents: 'none',
                        }}
                        dangerouslySetInnerHTML={{
                          __html: hljs.highlight(scriptInput, {
                            language: 'lua',
                          }).value,
                        }}
                      />
                    }
                  />
                  <Button onClick={() => act('runCode', { code: scriptInput })}>
                    Run
                  </Button>
                </Section>
              </Stack.Item>
              <Stack.Item grow shrink basis="45%">
                <Section
                  fill
                  pb="24px"
                  height={
                    activeTab === 'log'
                      ? showJumpToBottomButton
                        ? 'calc(100% - 48px)'
                        : 'calc(100% - 32px)'
                      : '100%'
                  }
                  width="100%"
                >
                  <Stack justify="space-between">
                    <Stack.Item>
                      <Tabs>
                        {!!showGlobalTable && (
                          <Tabs.Tab
                            selected={activeTab === 'globals'}
                            onClick={() => {
                              this.setState({ activeTab: 'globals' });
                            }}
                          >
                            Globals
                          </Tabs.Tab>
                        )}
                        <Tabs.Tab
                          selected={activeTab === 'tasks'}
                          onClick={() => this.setState({ activeTab: 'tasks' })}
                        >
                          Tasks
                        </Tabs.Tab>
                        <Tabs.Tab
                          selected={activeTab === 'log'}
                          onClick={() => {
                            this.setState({ activeTab: 'log' });
                            setTimeout(this.handleSectionScroll, 0);
                          }}
                        >
                          Log
                        </Tabs.Tab>
                      </Tabs>
                    </Stack.Item>
                    <Stack.Item>
                      <Button.Checkbox
                        inline
                        checked={showGlobalTable}
                        tooltip="WARNING: Displaying the global table can cause significant lag for the entire server, especially when there is a large number of global variables."
                        onClick={() => {
                          if (showGlobalTable && activeTab === 'globals') {
                            this.setState({ activeTab: 'tasks' });
                          }
                          act('toggleShowGlobalTable');
                        }}
                      >
                        Show Global Table
                      </Button.Checkbox>
                    </Stack.Item>
                  </Stack>
                  <Section
                    ref={this.sectionRef}
                    fill
                    scrollable
                    scrollableHorizontal
                    onScroll={this.handleSectionScroll}
                    width="100%"
                  >
                    {tabContent}
                  </Section>
                  {activeTab === 'log' && (
                    <>
                      <Stack justify="space-between">
                        <Stack.Item width="25%">
                          <Button
                            width="100%"
                            align="center"
                            icon="arrow-left"
                            disabled={page <= 0}
                            onClick={() => {
                              act('previousPage');
                            }}
                          />
                        </Stack.Item>
                        {!!pageCount && (
                          <Stack.Item width="50%">
                            <ProgressBar
                              width="100%"
                              value={page / (pageCount - 1)}
                            >
                              <Box width="100%" align="center">
                                {`Page ${page + 1}/${pageCount}`}
                              </Box>
                            </ProgressBar>
                          </Stack.Item>
                        )}
                        <Stack.Item width="25%">
                          <Button
                            width="100%"
                            align="center"
                            icon="arrow-right"
                            disabled={page >= pageCount - 1}
                            onClick={() => {
                              act('nextPage');
                            }}
                          />
                        </Stack.Item>
                      </Stack>
                      {showJumpToBottomButton && (
                        <Button
                          width="100%"
                          onClick={() => {
                            const sectionCurrent = this.sectionRef.current;
                            sectionCurrent.scrollTop =
                              sectionCurrent.scrollHeight;
                          }}
                        >
                          Jump to Bottom
                        </Button>
                      )}
                    </>
                  )}
                </Section>
              </Stack.Item>
            </Stack>
          )}
        </Window.Content>
        {modal === 'states' && <StateSelectModal />}
        {modal === 'viewChunk' && <ChunkViewModal />}
        {modal === 'call' && <CallModal />}
        {modal === 'documentation' && (
          <Modal>
            <Button
              color="red"
              icon="window-close"
              onClick={() => {
                setModal(null);
              }}
            >
              Close
            </Button>
            <Section
              height={`${window.innerHeight * 0.8}px`}
              width={`${window.innerWidth * 0.5}px`}
              fill
              scrollable
            >
              <Box
                dangerouslySetInnerHTML={{
                  __html: marked(sanitizeText(documentation), {
                    breaks: true,
                    smartypants: true,
                    smartLists: true,
                    langPrefix: 'hljs language-',
                    highlight: (code) => {
                      return hljs.highlight(code, { language: 'lua' }).value;
                    },
                  }),
                }}
              />
            </Section>
          </Modal>
        )}
      </Window>
    );
  }
}
