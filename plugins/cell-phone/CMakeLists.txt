cmake_minimum_required(VERSION 3.20)
project(cell_phone LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

enable_testing()

add_executable(phone_machine_test tests/phone_machine_test.cpp)
target_include_directories(phone_machine_test PRIVATE ${CMAKE_CURRENT_SOURCE_DIR})
add_test(NAME phone_machine COMMAND phone_machine_test)

add_library(cell-phone SHARED cell-phone.cpp)
set_target_properties(cell-phone PROPERTIES SUFFIX ".cleo" PREFIX "")
target_include_directories(cell-phone PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/sdk ${CMAKE_CURRENT_SOURCE_DIR})
target_link_libraries(cell-phone PRIVATE "${CMAKE_CURRENT_SOURCE_DIR}/sdk/VC.CLEO.lib")
